import { useEffect } from 'react';
/** Small pointer effects remain optional; all controls retain their native cursor and focus. */
export function useInteractions(enabled:boolean) {
 useEffect(()=>{
  if(!enabled||matchMedia('(prefers-reduced-motion: reduce)').matches||!matchMedia('(pointer: fine)').matches)return;
  let active:HTMLElement|null=null;
  const move=(event:PointerEvent)=>{
   const button=(event.target as HTMLElement).closest<HTMLElement>('.magnetic');
   if(active&&active!==button)active.style.transform='';
   active=button;
   if(button){const r=button.getBoundingClientRect();button.style.transform=`translate(${(event.clientX-r.left-r.width/2)*.07}px, ${(event.clientY-r.top-r.height/2)*.12}px)`}
  };
  const click=(event:PointerEvent)=>{
   if(!(event.target as HTMLElement).closest('button,a')||(event.target as HTMLElement).closest('.jn-workspace'))return;
   const ripple=document.createElement('span');ripple.className='click-ripple';ripple.style.left=`${event.clientX}px`;ripple.style.top=`${event.clientY}px`;document.body.append(ripple);ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
  };
  document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerdown',click,{passive:true});
  return()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerdown',click);if(active)active.style.transform='';document.querySelectorAll('.click-ripple').forEach(e=>e.remove())};
 },[enabled]);
}
