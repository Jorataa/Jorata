import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { action, check, db } from './client';
import type { ChatMessage, Community, CommunityMember, Member, Profile, Reaction, Room, Task } from './types';

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
      s.from('jr_rooms').select('*').order('updated_at',{ascending:false}),
      s.from('jr_room_members').select('*'),
      s.from('jr_communities').select('*').order('created_at'),
      s.from('jr_community_members').select('*'),
      s.from('jr_blocks').select('blocked_id'),
    ]);
    results.forEach(check);
    if(indexVersion.current!==version)return;
    setProfiles(results[0].data as Profile[]); setRooms(results[1].data as Room[]); setMembers(results[2].data as Member[]);
    setCommunities(results[3].data as Community[]); setCommunityMembers(results[4].data as CommunityMember[]);
    setBlocks(results[5].data!.map(row=>row.blocked_id));
    if(roomRef.current && !results[1].data!.some(r=>r.id===roomRef.current)) { setSelected(null); setMessages([]); setTasks([]); }
  },[userId]);
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
    const update = () => { if(active) refresh().catch(e=>setError(e.message)); };
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
    document.addEventListener('visibilitychange',visible); window.addEventListener('online',update);
    return ()=>{active=false;clearInterval(poll);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',update);void db().removeChannel(changes);void db().removeChannel(presence);};
  },[refresh,userId]);
  useEffect(() => {
    setMessages([]);setReactions([]);setTasks([]);setTyping([]);limit.current=100;
    if(!selected) return;
    setLoading(true);
    loadRoom().catch(e=>setError(e.message)).finally(()=>setLoading(false));
    const lastTyping=new Map<string,number>();
    const channel=db().channel(`jr-room:${selected}`,{config:{private:true}});
    roomChannel.current=channel;
    channel.on('broadcast',{event:'typing'},({payload})=>{
      if(typeof payload.user_id==='string'&&payload.user_id!==userId) lastTyping.set(payload.user_id,Date.now());
    }).subscribe(value=>{if(value==='SUBSCRIBED') loadRoom().catch(e=>setError(e.message));});
    const timer=setInterval(()=>{setTyping([...lastTyping].filter(([,at])=>Date.now()-at<3500).map(([id])=>id));},800);
    return ()=>{clearInterval(timer);roomChannel.current=null;void db().removeChannel(channel);};
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
  return {profiles,rooms,members,communities,communityMembers,blocks,selected,setSelected,messages,reactions,tasks,online,typing,status,error,setError,loading,mutate,refresh,searchProfiles,sendTyping,
    loadOlder:async()=>{limit.current+=100;await loadRoom();},
  };
}
