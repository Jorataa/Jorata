import {useEffect} from 'react';
/** Optional pointer feedback: native controls and touch interactions remain unchanged. */
export function useInteractions(enabled:boolean){
 useEffect(()=>{
  if(!enabled)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer: fine)');let active:HTMLElement|null=null;
  const reset=()=>{if(active)active.style.transform='';active=null;};
  const move=(event:PointerEvent)=>{
   if(reduced.matches||!fine.matches){reset();return;}
   const button=(event.target as HTMLElement).closest<HTMLElement>('.magnetic');if(active&&active!==button)reset();active=button;
   if(button){const r=button.getBoundingClientRect();const x=Math.max(-2,Math.min(2,(event.clientX-r.left-r.width/2)*.045)),y=Math.max(-2,Math.min(2,(event.clientY-r.top-r.height/2)*.045));button.style.transform=`translate(${x}px,${y}px)`;}
  };
  document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',reset);window.addEventListener('blur',reset);reduced.addEventListener('change',reset);
  return()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',reset);window.removeEventListener('blur',reset);reduced.removeEventListener('change',reset);reset();};
 },[enabled]);
}
