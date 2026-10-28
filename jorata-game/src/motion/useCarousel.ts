import {useEffect,useRef,useState} from 'react';

type Position={progress:number;first:number;last:number;canPrevious:boolean;canNext:boolean};
const cardStops=(host:HTMLElement)=>{const max=host.scrollWidth-host.clientWidth,padding=parseFloat(getComputedStyle(host).paddingLeft)||0;return [...host.querySelectorAll<HTMLElement>('.game-card')].map(card=>Math.max(0,Math.min(max,card.offsetLeft-padding)));};
const initial:Position={progress:0,first:1,last:1,canPrevious:false,canNext:false};
/** Browsing is functional even with all optional motion disabled. Touch uses native scrolling. */
export function useCarousel(motion:boolean){
 const ref=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState(initial);
 const allowed=useRef(motion);allowed.current=motion;
 const travel=(left:number)=>ref.current?.scrollTo({left,behavior:allowed.current?'smooth':'instant'});
 const offsets=()=>ref.current?cardStops(ref.current):[];
 const jump=(index:number)=>travel(offsets()[index]??0);
 const step=(direction:number)=>{const host=ref.current;if(!host)return;const targets=offsets();travel(direction>0?(targets.find(left=>left>host.scrollLeft+3)??host.scrollWidth):([...targets].reverse().find(left=>left<host.scrollLeft-3)??0));};
 const scrub=(percent:number)=>{const host=ref.current;if(host)host.scrollTo({left:(host.scrollWidth-host.clientWidth)*percent/100,behavior:'instant'});};
 useEffect(()=>{
  const host=ref.current;if(!host)return;
  let frame=0,clickTimer:ReturnType<typeof setTimeout>|undefined,suppressClick=false;
  let gesture:{pointer:number;start:number;left:number;last:number;time:number;velocity:number;dragged:boolean}|null=null;
  const measure=()=>{
   frame=0;const max=Math.max(0,host.scrollWidth-host.clientWidth),left=Math.max(0,Math.min(max,host.scrollLeft)),bounds=host.getBoundingClientRect();
   const visible=[...host.querySelectorAll<HTMLElement>('.game-card')].map((card,index)=>({index,rect:card.getBoundingClientRect()})).filter(({rect})=>Math.min(rect.right,bounds.right)-Math.max(rect.left,bounds.left)>Math.min(48,rect.width*.25));
   const next={progress:max?left/max*100:0,first:(visible[0]?.index??0)+1,last:(visible.at(-1)?.index??0)+1,canPrevious:left>2,canNext:left<max-2};
   host.style.setProperty('--carousel-progress',String(next.progress/100));
   setPosition(old=>Object.keys(next).every(key=>old[key as keyof Position]===next[key as keyof Position])?old:next);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  const stop=()=>host.scrollTo({left:host.scrollLeft,behavior:'instant'});
  const snap=(left:number)=>{
   const max=host.scrollWidth-host.clientWidth;
   const targets=[0,...cardStops(host),max];
   const target=targets.reduce((best,value)=>Math.abs(value-left)<Math.abs(best-left)?value:best,0);
   host.scrollTo({left:target,behavior:allowed.current?'smooth':'instant'});
  };
  const finish=(coast:boolean)=>{
   if(!gesture)return;const current=gesture;gesture=null;
   if(host.hasPointerCapture(current.pointer))host.releasePointerCapture(current.pointer);
   delete host.dataset.dragging;host.style.removeProperty('--drag-skew');
   if(current.dragged){suppressClick=true;clearTimeout(clickTimer);clickTimer=setTimeout(()=>{suppressClick=false;},250);if(coast)snap(host.scrollLeft-(allowed.current?current.velocity*140:0));}
   schedule();
  };
  const down=(event:PointerEvent)=>{
   if(event.button!==0||event.pointerType!=='mouse'||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
   if(event.target instanceof Element&&event.target.closest('button,input,select,textarea'))return;
   suppressClick=false;stop();gesture={pointer:event.pointerId,start:event.clientX,left:host.scrollLeft,last:event.clientX,time:performance.now(),velocity:0,dragged:false};
  };
  const move=(event:PointerEvent)=>{
   if(!gesture||gesture.pointer!==event.pointerId)return;
   const delta=event.clientX-gesture.start,now=performance.now();
   if(!gesture.dragged&&Math.abs(delta)>6){gesture.dragged=true;host.dataset.dragging='true';host.setPointerCapture(event.pointerId);}
   if(!gesture.dragged)return;
   gesture.velocity=Math.max(-2,Math.min(2,.65*(event.clientX-gesture.last)/Math.max(1,now-gesture.time)+.35*gesture.velocity));
   gesture.last=event.clientX;gesture.time=now;host.scrollLeft=gesture.left-delta;
   if(allowed.current)host.style.setProperty('--drag-skew',`${Math.max(-1.5,Math.min(1.5,-gesture.velocity*1.5))}deg`);
   event.preventDefault();schedule();
  };
  const up=(event:PointerEvent)=>{if(gesture?.pointer===event.pointerId)finish(event.type==='pointerup');};
  const cancel=()=>finish(false);
  const click=(event:MouseEvent)=>{if(suppressClick&&event.detail>0){suppressClick=false;event.preventDefault();event.stopPropagation();}};
  const nativeDrag=(event:DragEvent)=>event.preventDefault();
  const key=(event:KeyboardEvent)=>{
   if(event.target!==host||event.ctrlKey||event.metaKey||event.altKey)return;
   const max=host.scrollWidth-host.clientWidth,targets=cardStops(host);
   const left=event.key==='Home'?0:event.key==='End'?max:event.key==='ArrowRight'?(targets.find(value=>value>host.scrollLeft+3)??max):event.key==='ArrowLeft'?([...targets].reverse().find(value=>value<host.scrollLeft-3)??0):null;
   if(left!==null){event.preventDefault();host.scrollTo({left,behavior:allowed.current?'smooth':'instant'});}
  };
  measure();const resize=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;resize?.observe(host);
  host.addEventListener('scroll',schedule,{passive:true});host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move);host.addEventListener('pointerup',up);host.addEventListener('pointercancel',up);host.addEventListener('lostpointercapture',cancel);host.addEventListener('click',click,true);host.addEventListener('dragstart',nativeDrag);host.addEventListener('keydown',key);host.addEventListener('wheel',stop,{passive:true});window.addEventListener('blur',cancel);window.addEventListener('resize',schedule);
  return()=>{finish(false);cancelAnimationFrame(frame);clearTimeout(clickTimer);resize?.disconnect();delete host.dataset.dragging;host.style.removeProperty('--carousel-progress');host.removeEventListener('scroll',schedule);host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',up);host.removeEventListener('pointercancel',up);host.removeEventListener('lostpointercapture',cancel);host.removeEventListener('click',click,true);host.removeEventListener('dragstart',nativeDrag);host.removeEventListener('keydown',key);host.removeEventListener('wheel',stop);window.removeEventListener('blur',cancel);window.removeEventListener('resize',schedule);};
 },[]);
 useEffect(()=>{if(!motion){const host=ref.current;host?.scrollTo({left:host.scrollLeft,behavior:'instant'});}},[motion]);
 return {ref,...position,jump,step,scrub};
}
