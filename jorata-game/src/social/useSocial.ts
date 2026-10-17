import { useCallback, useEffect, useRef, useState } from 'react';
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
      s.from('jr_activity').select('user_id,last_seen'),
    ]);
    results.forEach(check);
    if(indexVersion.current!==version)return;
    setProfiles(results[0].data as Profile[]); setRooms(results[1].data as Room[]); setMembers(results[2].data as Member[]);
    setCommunities(results[3].data as Community[]); setCommunityMembers(results[4].data as CommunityMember[]);
    setBlocks(results[5].data!.map(row=>row.blocked_id));
    setOnline(results[6].data!.filter(row=>Date.now()-Date.parse(row.last_seen)<65000).map(row=>row.user_id));
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
    const activity=db().channel(`jr-activity:${userId}`).on('postgres_changes',{event:'*',schema:'public',table:'jr_activity'},()=>{
      void db().from('jr_activity').select('user_id,last_seen').then(result=>{if(active&&!result.error)setOnline(result.data.filter(row=>Date.now()-Date.parse(row.last_seen)<65000).map(row=>row.user_id));});
    }).subscribe();
    const touch=()=>{if(active)void db().rpc('jr_touch',{room_id:roomRef.current,typing:false});};
    touch();const heartbeat=setInterval(touch,30000);
    const poll=setInterval(update,12000);
    const visible=()=>{ if(document.visibilityState==='visible') update(); };
    document.addEventListener('visibilitychange',visible); window.addEventListener('online',update);
    return ()=>{active=false;clearInterval(poll);clearInterval(heartbeat);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',update);void db().removeChannel(changes);void db().removeChannel(activity);};
  },[refresh,userId]);
  useEffect(() => {
    setMessages([]);setReactions([]);setTasks([]);setTyping([]);limit.current=100;
    if(!selected) return;
    setLoading(true);
    loadRoom().catch(e=>setError(e.message)).finally(()=>setLoading(false));
    typingAt.current=0;
    const lastTyping=new Map<string,number>();let active=true;
    const updateTyping=()=>{void db().from('jr_activity').select('user_id,typing_until').eq('room_id',selected).then(result=>{if(!active||result.error)return;lastTyping.clear();for(const row of result.data||[])if(row.user_id!==userId&&row.typing_until)lastTyping.set(row.user_id,Date.parse(row.typing_until));});};
    void db().rpc('jr_touch',{room_id:selected,typing:false});
    const channel=db().channel(`jr-typing:${selected}`).on('postgres_changes',{event:'*',schema:'public',table:'jr_activity',filter:`room_id=eq.${selected}`},updateTyping).subscribe(value=>{if(value==='SUBSCRIBED'){updateTyping();void loadRoom().catch(e=>setError(e.message));}});
    const timer=setInterval(()=>{setTyping([...lastTyping].filter(([,until])=>Date.now()<until).map(([id])=>id));},500);
    return ()=>{active=false;clearInterval(timer);void db().removeChannel(channel);};
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
    if(roomRef.current)void db().rpc('jr_touch',{room_id:roomRef.current,typing:true});
  }
  return {profiles,rooms,members,communities,communityMembers,blocks,selected,setSelected,messages,reactions,tasks,online,typing,status,error,setError,loading,mutate,refresh,searchProfiles,sendTyping,
    loadOlder:async()=>{limit.current+=100;await loadRoom();},
  };
}
