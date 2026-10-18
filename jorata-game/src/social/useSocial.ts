import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { action, check, db } from './client';
import type { ChatMessage, Community, CommunityMember, ConversationSummary, Member, Profile, Reaction, Room, Task } from './types';

type ReadCursors = Record<string, string>;

function savedReadCursors(key: string): ReadCursors {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] =>
      typeof entry[1] === 'string' && Number.isFinite(Date.parse(entry[1]))));
  } catch { return {}; }
}

// This browser's reading position is deliberately separate from delivery/read receipts.
export function useReadCursors(identity: string) {
  const key = `jorata-read-cursors-v1:${identity}`;
  const [readCursors, setReadCursors] = useState<ReadCursors>(() => savedReadCursors(key));
  const readCursorsRef = useRef(readCursors);
  useEffect(() => {
    const cursors = savedReadCursors(key);
    readCursorsRef.current = cursors;
    setReadCursors(cursors);
  }, [key]);
  const markThrough = useCallback((roomId: string, createdAt: string) => {
    if (!Number.isFinite(Date.parse(createdAt))) return false;
    const previous = readCursorsRef.current[roomId];
    if (previous && Date.parse(previous) >= Date.parse(createdAt)) return false;
    const next = { ...readCursorsRef.current, [roomId]: createdAt };
    readCursorsRef.current = next;
    setReadCursors(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Reading still works when storage is unavailable. */ }
    return true;
  }, [key]);
  return { readCursors, readCursorsRef, markThrough };
}

export function useSocial(userId: string) {
  const [profiles,setProfiles] = useState<Profile[]>([]);
  const [rooms,setRooms] = useState<Room[]>([]);
  const [members,setMembers] = useState<Member[]>([]);
  const [communities,setCommunities] = useState<Community[]>([]);
  const [communityMembers,setCommunityMembers] = useState<CommunityMember[]>([]);
  const [blocks,setBlocks] = useState<string[]>([]);
  const [selected,setSelected] = useState<string | null>(null);
  const [messages,setMessages] = useState<ChatMessage[]>([]);
  const [reactions,setReactions] = useState<Reaction[]>([]);
  const [tasks,setTasks] = useState<Task[]>([]);
  const [online,setOnline] = useState<string[]>([]);
  const [typing,setTyping] = useState<string[]>([]);
  const [status,setStatus] = useState('Connecting');
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const [indexLoading,setIndexLoading] = useState(true);
  const [conversationSummaries,setConversationSummaries] = useState<Record<string,ConversationSummary>>({});
  const [unreadCounts,setUnreadCounts] = useState<Record<string,number>>({});
  const {readCursorsRef,markThrough}=useReadCursors(`account:${userId}`);
  const messagesRef=useRef(messages); messagesRef.current=messages;
  const summaryRef=useRef(conversationSummaries); summaryRef.current=conversationSummaries;
  const roomRef = useRef(selected); roomRef.current=selected;
  const roomVersion = useRef(0);
  const indexVersion = useRef(0);
  const limit = useRef(100);
  const roomChannel = useRef<RealtimeChannel | null>(null);
  const typingAt = useRef(0);

  const loadIndex = useCallback(async () => {
    const version=++indexVersion.current;
    const s=db();
    const results = await Promise.all([
      s.from('jr_profiles').select('*').order('username').limit(500),
      s.from('jr_rooms').select('*,jr_messages(body,sender_id,created_at,attachment_path,deleted)')
        .order('updated_at',{ascending:false})
        .order('created_at',{referencedTable:'jr_messages',ascending:false})
        .order('id',{referencedTable:'jr_messages',ascending:false})
        .limit(1,{referencedTable:'jr_messages'}),
      s.from('jr_room_members').select('*'),
      s.from('jr_communities').select('*').order('created_at'),
      s.from('jr_community_members').select('*'),
      s.from('jr_blocks').select('blocked_id'),
    ]);
    results.forEach(check);
    if(indexVersion.current!==version)return;
    const indexedRooms=results[1].data as (Room & {jr_messages:Pick<ChatMessage,'body'|'sender_id'|'created_at'|'attachment_path'|'deleted'>[]})[];
    const summaries:Record<string,ConversationSummary>={};
    for(const room of indexedRooms) {
      const message=room.jr_messages[0];
      if(message) summaries[room.id]={body:message.body,senderId:message.sender_id,createdAt:message.created_at,attachment:Boolean(message.attachment_path),deleted:message.deleted};
    }
    setConversationSummaries(summaries);
    setProfiles(results[0].data as Profile[]); setRooms(indexedRooms.map(({jr_messages:_,...room})=>room)); setMembers(results[2].data as Member[]);
    setCommunities(results[3].data as Community[]); setCommunityMembers(results[4].data as CommunityMember[]);
    setBlocks(results[5].data!.map(row=>row.blocked_id));
    if(roomRef.current && !results[1].data!.some(r=>r.id===roomRef.current)) { setSelected(null); setMessages([]); setTasks([]); }
    setIndexLoading(false);
    // Count against each room's local cursor. Head-only requests avoid downloading histories.
    // A small batch keeps large inboxes from opening an unbounded number of requests.
    for(let offset=0;offset<indexedRooms.length;offset+=6) {
      if(indexVersion.current!==version)return;
      const counts=await Promise.all(indexedRooms.slice(offset,offset+6).map(async room=>{
        const cursor=readCursorsRef.current[room.id];
        const latest=summaries[room.id];
        if(!latest || (cursor && Date.parse(latest.createdAt)<=Date.parse(cursor))) return {id:room.id,cursor,count:0};
        let query=s.from('jr_messages').select('id',{count:'exact',head:true})
          .eq('room_id',room.id).neq('sender_id',userId).eq('deleted',false);
        if(cursor) query=query.gt('created_at',cursor);
        const result=await query; check(result);
        return {id:room.id,cursor,count:result.count || 0};
      }));
      if(indexVersion.current!==version)return;
      setUnreadCounts(previous=>{
        const next={...previous};
        for(const count of counts) {
          // A user may reach the bottom while a count request is still in flight.
          if(readCursorsRef.current[count.id]===count.cursor) next[count.id]=count.count;
        }
        return next;
      });
    }
  },[userId,readCursorsRef]);
  const loadRoom = useCallback(async () => {
    const rid=roomRef.current; if(!rid) return;
    const version=++roomVersion.current;
    const s=db();
    const [messageRows,taskRows] = await Promise.all([
      s.from('jr_messages').select('*').eq('room_id',rid).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(limit.current),
      s.from('jr_tasks').select('*').eq('room_id',rid).eq('deleted',false).order('updated_at'),
    ]);
    const next=check(messageRows) as ChatMessage[];
    const nextTasks=check(taskRows) as Task[];
    const reactionRows=next.length ? check(await s.from('jr_reactions').select('*').in('message_id',next.map(m=>m.id)).eq('active',true)) as Reaction[] : [];
    if(roomRef.current===rid && roomVersion.current===version) { setMessages(next.reverse()); setTasks(nextTasks); setReactions(reactionRows); }
  },[userId]);
  const refresh = useCallback(async () => { await Promise.all([loadIndex(),loadRoom()]); },[loadIndex,loadRoom]);
  useEffect(() => {
    let active=true;
    const update = () => { if(active) refresh().catch(e=>{setError(e.message);setIndexLoading(false);}); };
    update();
    const changes=db().channel(`jr-changes:${userId}`);
    changes.on('system',{},payload=>{if(payload.status==='ok'&&payload.extension==='postgres_changes')update();});
    for(const table of ['jr_messages','jr_rooms','jr_reactions','jr_tasks']) {
      changes.on('postgres_changes',{event:'*',schema:'public',table},update);
    }
    changes.subscribe(value=>{
      if(!active) return;
      setStatus(value==='SUBSCRIBED'?'Live':value==='CHANNEL_ERROR'||value==='TIMED_OUT'?'Reconnecting':'Connecting');
      if(value==='SUBSCRIBED') update();
    });
    const presence=db().channel('jr-presence',{config:{private:true,presence:{key:userId}}});
    presence.on('presence',{event:'sync'},()=>{ if(active) setOnline(Object.keys(presence.presenceState())); });
    presence.subscribe(async value=>{ if(value==='SUBSCRIBED') await presence.track({user_id:userId}); });
    const poll=setInterval(update,12000);
    const visible=()=>{ if(document.visibilityState==='visible') update(); };
    const offline=()=>setStatus('Offline');
    document.addEventListener('visibilitychange',visible); window.addEventListener('online',update);window.addEventListener('offline',offline);
    return ()=>{active=false;clearInterval(poll);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',update);window.removeEventListener('offline',offline);void db().removeChannel(changes);void db().removeChannel(presence);};
  },[refresh,userId]);
  useEffect(() => {
    setMessages([]);setReactions([]);setTasks([]);setTyping([]);limit.current=100;setLoading(false);
    if(!selected) return;
    setLoading(true);
    let active=true;
    loadRoom().catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    const lastTyping=new Map<string,number>();
    const channel=db().channel(`jr-room:${selected}`,{config:{private:true}});
    roomChannel.current=channel;
    channel.on('broadcast',{event:'typing'},({payload})=>{
      if(typeof payload.user_id==='string'&&payload.user_id!==userId) lastTyping.set(payload.user_id,Date.now());
    }).subscribe(value=>{if(value==='SUBSCRIBED') loadRoom().catch(e=>setError(e.message));});
    const timer=setInterval(()=>{setTyping([...lastTyping].filter(([,at])=>Date.now()-at<3500).map(([id])=>id));},800);
    return ()=>{active=false;clearInterval(timer);roomChannel.current=null;void db().removeChannel(channel);};
  },[selected,loadRoom,userId]);
  async function mutate(name:string,payload:Record<string,unknown>={}) {
    const result=await action(name,{room_id:roomRef.current,...payload});
    await refresh(); return result;
  }
  async function searchProfiles(query:string) {
    const term=query.normalize('NFKC').replace(/[^a-zA-Z0-9_]/g,'');
    if(!term) return [];
    const found=check(await db().from('jr_profiles').select('*').ilike('username',`%${term}%`).limit(30)) as Profile[];
    setProfiles(current=>[...current.filter(p=>!found.some(f=>f.id===p.id)),...found]);
    return found;
  }
  function sendTyping() {
    if(Date.now()-typingAt.current<1500) return;
    typingAt.current=Date.now();
    void roomChannel.current?.send({type:'broadcast',event:'typing',payload:{user_id:userId}});
  }
  const markRead=useCallback((roomId:string)=>{
    if(document.visibilityState!=='visible'||roomRef.current!==roomId)return;
    const latest=messagesRef.current.filter(message=>message.room_id===roomId).at(-1);
    if(!latest || !markThrough(roomId,latest.created_at))return;
    const summary=summaryRef.current[roomId];
    if(!summary || Date.parse(summary.createdAt)<=Date.parse(latest.created_at)) {
      setUnreadCounts(current=>({...current,[roomId]:0}));
    }
  },[markThrough]);
  return {profiles,rooms,members,communities,communityMembers,blocks,selected,setSelected,messages,reactions,tasks,online,typing,status,error,setError,loading,indexLoading,conversationSummaries,unreadCounts,markRead,mutate,refresh,searchProfiles,sendTyping,
    loadOlder:async()=>{limit.current+=100;await loadRoom();},
  };
}
