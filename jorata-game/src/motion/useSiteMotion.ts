import {useEffect} from 'react';
import type {Page} from '../ui';
export const isWebsite=(page:Page)=>['home','games','notes','settings','missing'].includes(page);
/** Optional presentation behavior. Does not cancel input events or observe game canvases. */
export function useSiteMotion(enabled:boolean,page:Page){
 useEffect(()=>{
  if(!enabled||!isWebsite(page)||typeof IntersectionObserver==='undefined')return;
  const scope=document.querySelector<HTMLElement>('[data-site-motion]');if(!scope)return;
  scope.classList.add('motion-live');
  const fine=matchMedia('(hover: hover) and (pointer: fine)'),animations=new Set<Animation>(),seen=new WeakSet<Element>();
  const animate=(el:HTMLElement,frames:Keyframe[],duration=420)=>{
   if(!el.animate)return;const animation=el.animate(frames,{duration,easing:'cubic-bezier(.22,1,.36,1)'});animations.add(animation);void animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));
  };
  const reveals=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const el=entry.target as HTMLElement;reveals.unobserve(el);animate(el,[{opacity:.4,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}]);}},{threshold:.08});
  const hero=scope.querySelector<HTMLElement>('.world-invitation');
  const atmosphere=new IntersectionObserver(entries=>{for(const entry of entries){(entry.target as HTMLElement).dataset.inView=entry.isIntersecting?'true':'false';if(entry.isIntersecting)onScroll();}},{threshold:.05});if(hero)atmosphere.observe(hero);
  const observe=()=>{for(const el of scope.querySelectorAll('.discovery-heading,.home-games .game-card,.games-list .game-card,.home-bottom,.setting-row'))if(!seen.has(el)){seen.add(el);reveals.observe(el);}};
  observe();const mutations=new MutationObserver(observe);mutations.observe(scope,{childList:true,subtree:true});
  let active:HTMLElement|null=null,frame=0,px=0,py=0;
  const reset=()=>{if(active){active.style.removeProperty('--pointer-x');active.style.removeProperty('--pointer-y');active.style.removeProperty('--magnet-x');active.style.removeProperty('--magnet-y');active.style.removeProperty('--tilt-x');active.style.removeProperty('--tilt-y');active=null;}hero?.style.removeProperty('--hero-x');hero?.style.removeProperty('--hero-y');};
  const draw=()=>{
   frame=0;if(!active)return;const rect=active.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(px-rect.left)/rect.width*2-1)),y=Math.max(-1,Math.min(1,(py-rect.top)/rect.height*2-1));
   if(active.classList.contains('game-cover')){active.style.setProperty('--tilt-x',`${-y*1.5}deg`);active.style.setProperty('--tilt-y',`${x*1.5}deg`);active.style.setProperty('--pointer-x',`${(x+1)*50}%`);active.style.setProperty('--pointer-y',`${(y+1)*50}%`);}
   else if(active.classList.contains('world-invitation')){active.style.setProperty('--hero-x',`${x*5}px`);active.style.setProperty('--hero-y',`${y*4}px`);}
   else{active.style.setProperty('--magnet-x',`${x*3}px`);active.style.setProperty('--magnet-y',`${y*3}px`);}
  };
  const move=(event:PointerEvent)=>{
   if(!fine.matches||event.pointerType==='touch')return;
   const el=event.target instanceof Element?event.target:null;
   const target=el?.closest<HTMLElement>('.game-cover,.invitation-copy .ui-button,.quick-launch,.world-invitation,.carousel-btn')??null;
   if(target!==active){reset();active=target;}px=event.clientX;py=event.clientY;if(active&&!frame)frame=requestAnimationFrame(draw);
  };
  const leave=(event:PointerEvent)=>{if(active&&!(event.relatedTarget instanceof Node&&active.contains(event.relatedTarget)))reset();};
  let scrollFrame=0;
  const onScroll=()=>{
   if(scrollFrame||!hero||hero.dataset.inView==='false')return;
   scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;hero.style.setProperty('--scroll-y',`${Math.min(260,Math.max(0,window.scrollY))}px`);});
  };
  onScroll();
  let dragged:HTMLElement|null=null,dropTarget:HTMLElement|null=null;let before=new Map<HTMLElement,DOMRect>();
  const clearTarget=()=>{dropTarget?.classList.remove('motion-drop-target');dropTarget=null;};
  const dropCandidate=(event:DragEvent)=>{
   const el=event.target instanceof Element?event.target.closest<HTMLElement>('.jn-note-row,nav[aria-label="Note folders"] button'):null;
   if(!el||el===dragged)return null;
   if(el.closest('nav[aria-label="Note folders"]')&&[...el.parentElement!.querySelectorAll<HTMLElement>('button')].indexOf(el)<2)return null;
   return el;
  };
  const dragStart=(event:DragEvent)=>{const el=event.target instanceof Element?event.target.closest<HTMLElement>('.jn-note-row'):null;if(!el)return;dragged=el;el.classList.add('motion-dragging');};
  const dragOver=(event:DragEvent)=>{if(!dragged)return;const candidate=dropCandidate(event);if(candidate!==dropTarget){clearTarget();dropTarget=candidate;dropTarget?.classList.add('motion-drop-target');}};
  const end=()=>{dragged?.classList.remove('motion-dragging');dragged=null;clearTarget();};
  let reorderFrame=0;
  const settleRows=()=>{
   before=new Map([...scope.querySelectorAll<HTMLElement>('.jn-note-row')].map(el=>[el,el.getBoundingClientRect()]));
   cancelAnimationFrame(reorderFrame);
   reorderFrame=requestAnimationFrame(()=>{for(const [el,rect] of before)if(el.isConnected){const next=el.getBoundingClientRect(),delta=rect.top-next.top;if(Math.abs(delta)>1)animate(el,[{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],300);}before.clear();});
  };
  const drop=()=>{if(!dragged)return;settleRows();end();};
  const reorderClick=(event:MouseEvent)=>{if(event.target instanceof Element&&event.target.closest('.jn-reorder:not(:disabled)'))settleRows();};
  const dragLeave=(event:DragEvent)=>{if(dropTarget&&!(event.relatedTarget instanceof Node&&dropTarget.contains(event.relatedTarget)))clearTarget();};
  let panel:HTMLElement|null=null,origin=0;
  const panelDown=(event:PointerEvent)=>{const handle=event.target instanceof Element?event.target.closest('.jn-drag-handle'):null;if(!handle||(event.target as Element).closest('button'))return;panel=handle.closest<HTMLElement>('.jn-quick');origin=event.clientX;panel?.classList.add('motion-panel-dragging');};
  const panelMove=(event:PointerEvent)=>{panel?.style.setProperty('--drag-rotation',`${Math.max(-1,Math.min(1,(event.clientX-origin)*.01))}deg`);};
  const panelUp=()=>{
   if(panel?.isConnected&&!panel.contains(document.activeElement)){
    const target=panel.querySelector<HTMLElement>('textarea')??panel.querySelector<HTMLElement>('button');
    target?.focus({preventScroll:true});
    requestAnimationFrame(()=>target?.focus({preventScroll:true}));
   }
   panel?.classList.remove('motion-panel-dragging');panel?.style.removeProperty('--drag-rotation');panel=null;
  };
  scope.addEventListener('pointermove',move,{passive:true});scope.addEventListener('pointerout',leave,{passive:true});scope.addEventListener('pointerdown',panelDown,{passive:true});window.addEventListener('pointermove',panelMove,{passive:true});window.addEventListener('pointerup',panelUp,{passive:true});window.addEventListener('pointercancel',panelUp,{passive:true});window.addEventListener('scroll',onScroll,{passive:true});
  scope.addEventListener('click',reorderClick,true);scope.addEventListener('dragleave',dragLeave,true);window.addEventListener('blur',end);scope.addEventListener('dragstart',dragStart,true);scope.addEventListener('dragover',dragOver,true);scope.addEventListener('drop',drop,true);scope.addEventListener('dragend',end,true);window.addEventListener('blur',reset);window.addEventListener('blur',panelUp);
  return()=>{reset();end();panelUp();cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame);cancelAnimationFrame(reorderFrame);mutations.disconnect();reveals.disconnect();atmosphere.disconnect();for(const animation of animations)animation.cancel();scope.classList.remove('motion-live');if(hero){delete hero.dataset.inView;hero.style.removeProperty('--scroll-y');}scope.removeEventListener('pointermove',move);scope.removeEventListener('pointerout',leave);scope.removeEventListener('pointerdown',panelDown);window.removeEventListener('pointermove',panelMove);window.removeEventListener('pointerup',panelUp);window.removeEventListener('pointercancel',panelUp);window.removeEventListener('scroll',onScroll);scope.removeEventListener('click',reorderClick,true);scope.removeEventListener('dragleave',dragLeave,true);window.removeEventListener('blur',end);scope.removeEventListener('dragstart',dragStart,true);scope.removeEventListener('dragover',dragOver,true);scope.removeEventListener('drop',drop,true);scope.removeEventListener('dragend',end,true);window.removeEventListener('blur',reset);window.removeEventListener('blur',panelUp);};
 },[enabled,page]);
 // Active navigation follows actual route changes and resizes, including the mobile dock.
 useEffect(()=>{
  const nav=document.querySelector<HTMLElement>('.dock');if(!nav)return;
  const measure=()=>{const active=nav.querySelector<HTMLElement>('[aria-current=page]');if(active){const a=active.getBoundingClientRect(),n=nav.getBoundingClientRect();nav.style.setProperty('--nav-x',`${a.left-n.left+12}px`);nav.style.setProperty('--nav-width',String(Math.max(0,a.width-24)));}};
  measure();if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}
  const resize=new ResizeObserver(measure);resize.observe(nav);return()=>resize.disconnect();
 },[page]);
}
