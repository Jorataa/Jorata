import {useEffect,useRef} from 'react';
/** Two small DOM layers; frames stop as soon as the pointer settles. */
export default function Cursor({enabled}:{enabled:boolean}){
 const ring=useRef<HTMLDivElement>(null),trail=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!enabled)return;
  const fine=matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)');
  const scope=document.querySelector<HTMLElement>('[data-site-motion]');
  if(!scope||!ring.current||!trail.current)return;
  const el=ring.current,dot=trail.current;let frame=0,x=0,y=0,tx=0,ty=0,dx=0,dy=0,shown=false,last=0;
  const hide=()=>{delete el.dataset.pressed;shown=false;el.dataset.visible='false';dot.dataset.visible='false';delete document.documentElement.dataset.cursorReady;cancelAnimationFrame(frame);frame=0;};
  const tick=(now:number)=>{
   const step=Math.min(2,(now-last)/16.67||1);last=now;
   x+=(tx-x)*(1-Math.pow(.35,step));y+=(ty-y)*(1-Math.pow(.35,step));
   dx+=(tx-dx)*(1-Math.pow(.68,step));dy+=(ty-dy)*(1-Math.pow(.68,step));
   el.style.transform=`translate3d(${x}px,${y}px,0)`;dot.style.transform=`translate3d(${dx}px,${dy}px,0)`;
   if(shown&&Math.abs(tx-dx)+Math.abs(ty-dy)>.25)frame=requestAnimationFrame(tick);else frame=0;
  };
  const move=(event:PointerEvent)=>{
   const target=event.target instanceof Element?event.target:null;
   if(event.pointerType==='touch'||!target||!fine.matches||!scope.contains(target)||target.closest('canvas,input,textarea,select,[contenteditable=true],iframe,[data-native-cursor]')){hide();return;}
   tx=event.clientX;ty=event.clientY;
   if(!shown){x=dx=tx;y=dy=ty;shown=true;el.dataset.visible='true';dot.dataset.visible='true';document.documentElement.dataset.cursorReady='true';}
   const mode=target.closest('[draggable=true],.jn-drag-handle')?'drag':target.closest('.game-cover,.game-launch')?'play':target.closest('a,button')?'link':'idle';
   el.dataset.mode=mode;el.dataset.label=mode==='play'?'Play':mode==='drag'?'Move':'';
   if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}
  };
  const press=()=>{el.dataset.pressed='true';},release=()=>{delete el.dataset.pressed;};
  const keyboard=(event:KeyboardEvent)=>{if(event.key==='Tab')hide();};
  const visibility=()=>{if(document.hidden)hide();};
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerdown',press,{passive:true});window.addEventListener('pointerup',release,{passive:true});
  window.addEventListener('keydown',keyboard);window.addEventListener('scroll',hide,{passive:true});document.addEventListener('dragstart',hide);window.addEventListener('blur',hide);document.addEventListener('pointerleave',hide);document.addEventListener('visibilitychange',visibility);fine.addEventListener('change',hide);
  return()=>{hide();window.removeEventListener('pointermove',move);window.removeEventListener('pointerdown',press);window.removeEventListener('pointerup',release);window.removeEventListener('keydown',keyboard);window.removeEventListener('scroll',hide);document.removeEventListener('dragstart',hide);window.removeEventListener('blur',hide);document.removeEventListener('pointerleave',hide);document.removeEventListener('visibilitychange',visibility);fine.removeEventListener('change',hide);};
 },[enabled]);
 return <><div ref={ring} className="jorata-cursor" aria-hidden="true"><i/></div><div ref={trail} className="jorata-cursor-trail" aria-hidden="true"/></>;
}
