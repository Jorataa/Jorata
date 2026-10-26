import {useContext,useEffect,useRef,useState} from 'react';
import {MotionContext} from './preferences';
/** Existing artwork only; no game engines are loaded by the gallery. */
export default function GamePreview({game}:{game:string}){
 const enabled=useContext(MotionContext),ref=useRef<HTMLSpanElement>(null),video=useRef<HTMLVideoElement>(null);
 const [active,setActive]=useState(false),[loaded,setLoaded]=useState(false);
 useEffect(()=>{
  const cover=ref.current?.closest<HTMLElement>('.game-cover');if(!cover)return;
  if(!enabled||typeof IntersectionObserver==='undefined'){delete cover.dataset.preview;setActive(false);return;}
  let visible=false,intent=false;const fine=matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)');
  const update=()=>{const next=visible&&intent&&fine.matches&&!document.hidden;setActive(next);if(next)setLoaded(true);cover.dataset.preview=next?'active':'idle';};
  const enter=(event:PointerEvent)=>{if(event.pointerType==='touch'||!fine.matches)return;intent=true;update();};
  const focus=()=>{intent=true;update();},leave=()=>{intent=false;update();};
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;update();},{threshold:.15});observer.observe(cover);
  cover.addEventListener('pointerenter',enter);cover.addEventListener('pointerleave',leave);cover.addEventListener('focus',focus);cover.addEventListener('blur',leave);document.addEventListener('visibilitychange',update);fine.addEventListener('change',update);
  return()=>{observer.disconnect();delete cover.dataset.preview;cover.removeEventListener('pointerenter',enter);cover.removeEventListener('pointerleave',leave);cover.removeEventListener('focus',focus);cover.removeEventListener('blur',leave);document.removeEventListener('visibilitychange',update);fine.removeEventListener('change',update);};
 },[enabled]);
 useEffect(()=>{const el=video.current;if(!el)return;if(active)void el.play().catch(()=>{/* Keep the original poster when autoplay is unavailable. */});else el.pause();return()=>el.pause();},[active,loaded]);
 const sprites=game==='boxing'||game==='rooftop',supported=sprites||game==='surgery';
 return <span ref={ref} className={`game-preview preview-${game} ${supported&&loaded&&enabled?'has-preview':''}`} data-active={active&&enabled?'true':'false'} aria-hidden="true">
  {supported&&loaded&&enabled&&<><span className="preview-window">{game==='surgery'?<video ref={video} src="/surgery/surgery_patient_01_healthy.mp4" poster="/surgery/healthy.png" muted loop playsInline preload="none" tabIndex={-1}/>:game==='rooftop'?<img className="runner-strip" src="/rooftop/assets/characters/runner/spritesheets/runner_run_spritesheet.png" width={768} height={96} alt=""/>:<span className="boxing-frames">{[1,2,3].map(n=><img key={n} src={`/boxing/characters/player_red/idle_0${n}.png`} width={96} height={96} alt="" style={{animationDelay:`${(n-1)*.24}s`}}/>)}</span>}</span><span className="preview-caption">Original animation</span></>}
 </span>;
}
