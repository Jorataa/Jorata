import {createContext,useEffect,useState} from 'react';
export const MotionContext=createContext(false);
type Connection=EventTarget & {saveData?:boolean};
/** A single preference gate for all optional website effects, never gameplay. */
export function useMotionPreference(enabled:boolean){
 const [allowed,setAllowed]=useState(false);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const connection=(navigator as Navigator & {connection?:Connection}).connection;
  const update=()=>setAllowed(enabled&&!media.matches&&!connection?.saveData);
  update();media.addEventListener('change',update);connection?.addEventListener('change',update);
  return()=>{media.removeEventListener('change',update);connection?.removeEventListener('change',update);};
 },[enabled]);
 return allowed;
}
