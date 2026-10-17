import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { check, supabase } from './client';
import type { Profile } from './types';
export function useAccount() {
  const [session,setSession] = useState<Session | null>(null);
  const [profile,setProfile] = useState<Profile | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({data,error}) => {
      if (alive) { setSession(data.session); if(error) setError(error.message); setLoading(false); }
    });
    const { data:{subscription} } = supabase.auth.onAuthStateChange((_event,value) => {
      if(alive) { setSession(value); if(!value) setProfile(null); }
    });
    return () => { alive=false; subscription.unsubscribe(); };
  },[]);
  const refresh = useCallback(async () => {
    if(!supabase || !session) return;
    const data = check(await supabase.from('jr_profiles').select('*').eq('id',session.user.id).maybeSingle()) as Profile | null;
    setProfile(data);
  },[session?.user.id]);
  useEffect(() => { if(session) { setLoading(true); refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false)); } },[refresh]);
  return { session,profile,loading,error,refresh };
}
