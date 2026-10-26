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
  const atmosphere=new IntersectionObserver(entries=>{for(const entry of entries)(entry.target as HTMLElement).dataset.inView=entry.isIntersecting?'true':'false';},{threshold:.05});if(hero)atmosphere.observe(hero);
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
  let carousel:HTMLElement|null=null,cStartX=0,cScrollStart=0,cLastX=0,cLastTime=0,cVel=0,cDragged=false,cMomentum=0,suppressClick=false;
  const stopMomentum=()=>{if(cMomentum){cancelAnimationFrame(cMomentum);cMomentum=0;}};
  const updateProgress=(host:HTMLElement)=>{
   const max=host.scrollWidth-host.clientWidth;
   const progress=max>0?Math.max(0,Math.min(1,host.scrollLeft/max)):0;
   scope.style.setProperty('--carousel-progress',`${progress}`);
   const activeIdx=Math.min(4,Math.max(0,Math.round(progress*4)));
   scope.querySelectorAll<HTMLElement>('.carousel-dot').forEach((dot,i)=>{
    dot.dataset.active=i===activeIdx?'true':'false';
   });
  };
  const cDown=(event:PointerEvent)=>{
   if(event.pointerType==='touch'||event.button!==0)return;
   const target=event.target instanceof Element?event.target:null;
   const host=target?.closest<HTMLElement>('[data-carousel]')??null;
   if(!host||target?.closest('button'))return;
   stopMomentum();carousel=host;cStartX=cLastX=event.clientX;cScrollStart=host.scrollLeft;cLastTime=performance.now();cVel=0;cDragged=false;
  };
  const cMove=(event:PointerEvent)=>{
   if(!carousel)return;
   const now=performance.now(),dx=event.clientX-cStartX,dt=Math.max(1,now-cLastTime);
   if(!cDragged&&Math.abs(dx)>4){cDragged=true;carousel.dataset.dragging='true';reset();}
   if(cDragged){
    const step=event.clientX-cLastX;
    cVel=.75*(step/dt)+.25*cVel;
    carousel.scrollLeft=cScrollStart-dx;
    cLastX=event.clientX;
    cLastTime=now;
    const skew=Math.max(-2.5,Math.min(2.5,-cVel*5));
    carousel.style.setProperty('--drag-skew',`${skew}deg`);
    updateProgress(carousel);
   }
  };
  const cUp=()=>{
   if(!carousel)return;
   const host=carousel,wasDragged=cDragged;carousel=null;cDragged=false;delete host.dataset.dragging;
   if(wasDragged){
    suppressClick=true;setTimeout(()=>{suppressClick=false;},80);
    let v=cVel*16;
    const coast=()=>{
     if(Math.abs(v)<.3||!host.isConnected){
      cMomentum=0;host.style.removeProperty('--drag-skew');
      updateProgress(host);
      return;
     }
     host.scrollLeft-=v;v*=.92;
     const skew=Math.max(-2,Math.min(2,-v*.3));
     host.style.setProperty('--drag-skew',`${skew}deg`);
     updateProgress(host);
     cMomentum=requestAnimationFrame(coast);
    };
    if(Math.abs(v)>.8)cMomentum=requestAnimationFrame(coast);
    else host.style.removeProperty('--drag-skew');
   }
  };
  const cClick=(event:MouseEvent)=>{if(suppressClick){suppressClick=false;event.preventDefault();event.stopPropagation();}};
  const cNativeDrag=(event:DragEvent)=>{const t=event.target instanceof Element?event.target:null;if(t?.closest('[data-carousel]')){event.preventDefault();event.stopImmediatePropagation();}};
  const cScroll=(event:Event)=>{const t=event.target instanceof HTMLElement?event.target:null;if(t?.hasAttribute('data-carousel'))updateProgress(t);};
  const gamesCarousel=scope.querySelector<HTMLElement>('[data-carousel="games"]');
  if(gamesCarousel)updateProgress(gamesCarousel);
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
  const drop=()=>{
   if(!dragged)return;before=new Map([...scope.querySelectorAll<HTMLElement>('.jn-note-row')].map(el=>[el,el.getBoundingClientRect()]));end();
   requestAnimationFrame(()=>{for(const [el,rect] of before)if(el.isConnected){const next=el.getBoundingClientRect(),delta=rect.top-next.top;if(Math.abs(delta)>1)animate(el,[{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],300);}before.clear();});
  };
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
  scope.addEventListener('pointermove',move,{passive:true});scope.addEventListener('pointerout',leave,{passive:true});scope.addEventListener('pointerdown',panelDown,{passive:true});scope.addEventListener('pointerdown',cDown,{passive:true});window.addEventListener('pointermove',panelMove,{passive:true});window.addEventListener('pointermove',cMove,{passive:true});window.addEventListener('pointerup',panelUp,{passive:true});window.addEventListener('pointerup',cUp,{passive:true});window.addEventListener('pointercancel',panelUp,{passive:true});window.addEventListener('pointercancel',cUp,{passive:true});scope.addEventListener('click',cClick,true);window.addEventListener('dragstart',cNativeDrag,true);window.addEventListener('scroll',onScroll,{passive:true});scope.addEventListener('scroll',cScroll,{capture:true,passive:true});
  scope.addEventListener('dragstart',dragStart,true);scope.addEventListener('dragover',dragOver,true);scope.addEventListener('drop',drop,true);scope.addEventListener('dragend',end,true);window.addEventListener('blur',reset);window.addEventListener('blur',panelUp);window.addEventListener('blur',cUp);
  return()=>{reset();end();panelUp();cUp();stopMomentum();cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame);mutations.disconnect();reveals.disconnect();atmosphere.disconnect();for(const animation of animations)animation.cancel();scope.classList.remove('motion-live');if(hero){delete hero.dataset.inView;hero.style.removeProperty('--scroll-y');}scope.removeEventListener('pointermove',move);scope.removeEventListener('pointerout',leave);scope.removeEventListener('pointerdown',panelDown);scope.removeEventListener('pointerdown',cDown);window.removeEventListener('pointermove',panelMove);window.removeEventListener('pointermove',cMove);window.removeEventListener('pointerup',panelUp);window.removeEventListener('pointerup',cUp);window.removeEventListener('pointercancel',panelUp);window.removeEventListener('pointercancel',cUp);scope.removeEventListener('click',cClick,true);window.removeEventListener('dragstart',cNativeDrag,true);window.removeEventListener('scroll',onScroll);scope.removeEventListener('scroll',cScroll,true);scope.removeEventListener('dragstart',dragStart,true);scope.removeEventListener('dragover',dragOver,true);scope.removeEventListener('drop',drop,true);scope.removeEventListener('dragend',end,true);window.removeEventListener('blur',reset);window.removeEventListener('blur',panelUp);window.removeEventListener('blur',cUp);};
 },[enabled,page]);
 // Active navigation follows actual route changes and resizes, including the mobile dock.
 useEffect(()=>{
  const nav=document.querySelector<HTMLElement>('.dock');if(!nav)return;
  const measure=()=>{const active=nav.querySelector<HTMLElement>('[aria-current=page]');if(active){const a=active.getBoundingClientRect(),n=nav.getBoundingClientRect();nav.style.setProperty('--nav-x',`${a.left-n.left+12}px`);nav.style.setProperty('--nav-width',String(Math.max(0,a.width-24)));}};
  measure();if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}
  const resize=new ResizeObserver(measure);resize.observe(nav);return()=>resize.disconnect();
 },[page]);
}
