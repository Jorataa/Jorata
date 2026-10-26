import {useEffect,useRef,useState} from 'react';
import Phaser from 'phaser';
import {RooftopScene,snapshot,type View} from './scene';
import {Run} from './model';
import {levels} from './levels';
import {loadSave,save,type Save} from './storage';
import './rooftop.css';
export default function Rooftop({onExit,reducedMotion=false,paused=false}:{onExit:()=>void;reducedMotion?:boolean;paused?:boolean}){
 const menuRef=useRef<HTMLDivElement>(null);
 const host=useRef<HTMLDivElement>(null),scene=useRef<RooftopScene|null>(null),saved=useRef<Save>(loadSave());
 const [prefs,setPrefs]=useState(saved.current),[view,setView]=useState<View>({...snapshot(new Run()),loading:0}),[select,setSelect]=useState(false);
 const [systemReduced,setSystemReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setSystemReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{
  const s=new RooftopScene(setView,r=>{const next={...saved.current,best:saved.current.best.map((n,i)=>i===r.index?Math.max(n,r.score):n),unlocked:Math.max(saved.current.unlocked,Math.min(2,r.index+1))};saved.current=next;save(next);setPrefs(next);});scene.current=s;
  const game=new Phaser.Game({type:Phaser.AUTO,parent:host.current!,backgroundColor:'#192a33',scale:{mode:Phaser.Scale.RESIZE,width:1100,height:620},render:{antialias:true,powerPreference:'high-performance'},audio:{noAudio:true},scene:s,fps:{target:60,smoothStep:true},banner:false});
  // Expose a read-only run reference only in development for deterministic browser verification.
  if(import.meta.env.DEV)(window as unknown as {__rooftop?:RooftopScene}).__rooftop=s;
  const key=(e:KeyboardEvent)=>{
   if(e.ctrlKey||e.metaKey||e.altKey)return;
   const k=e.key.toLowerCase(),playing=s.run.phase==='playing';
   if([' ','arrowup','arrowdown','s','j','x','r','escape'].includes(k)&&playing)e.preventDefault();
   if(e.repeat)return;
   if(k==='escape'){if(playing)s.pause();else if(s.run.phase==='paused')s.resume();return;}
   if(k==='r'&&(playing||s.run.phase==='failed')){s.retry();return;}
   if(!playing)return;
   if(k===' '||k==='arrowup')s.inputState.jump=true;if(k==='s'||k==='arrowdown')s.inputState.slide=true;if(k==='j'||k==='x')s.inputState.attack=true;
  };
  const up=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(k===' '||k==='arrowup')s.inputState.jump=false;if(k==='s'||k==='arrowdown')s.inputState.slide=false;if(k==='j'||k==='x')s.inputState.attack=false;};
  const blur=()=>s.pause(),visibility=()=>{if(document.hidden)s.pause();};
  window.addEventListener('keydown',key);window.addEventListener('keyup',up);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);s.soundCues.close();game.destroy(true);scene.current=null;if(import.meta.env.DEV)delete (window as unknown as {__rooftop?:RooftopScene}).__rooftop;};
 },[]);
 useEffect(()=>{const s=scene.current;if(s){s.soundCues.muted=prefs.muted;s.reduced=prefs.reduced||reducedMotion||systemReduced;}saved.current=prefs;save(prefs);},[prefs,reducedMotion,systemReduced]);
 useEffect(()=>{if(paused)scene.current?.pause();},[paused]);
 useEffect(()=>{if(view.loading===1&&view.phase!=='playing')menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});},[view.phase,view.loading,select]);
 const begin=(index:number)=>{scene.current?.begin(index);setSelect(false);};
 const touch=(key:'jump'|'slide'|'attack')=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);if(scene.current?.run.phase==='playing')scene.current.inputState[key]=true;},onPointerUp:()=>{if(scene.current)scene.current.inputState[key]=false;},onPointerCancel:()=>{if(scene.current)scene.current.inputState[key]=false;},onLostPointerCapture:()=>{if(scene.current)scene.current.inputState[key]=false;}});
 const active=view.phase==='playing',menu=view.phase==='menu',done=view.phase==='complete';
 return <section className="roof-game" aria-label="JORATA Rooftop Escape">
  <header className="roof-toolbar"><button onClick={onExit} aria-label="Back to game library">← Games</button><span>JORATA — Rooftop Escape</span><div><button onClick={()=>setPrefs(p=>({...p,muted:!p.muted}))} aria-pressed={prefs.muted}>{prefs.muted?'Unmute':'Mute'}</button><button onClick={()=>scene.current?.pause()} disabled={!active}>Pause</button></div></header>
  <div className="roof-stage"><div ref={host} className="roof-canvas" aria-label="Automatic rooftop runner. Jump gaps, slide under beams, and attack guards." role="img"/>
   {!menu&&<div className="roof-hud"><div className="roof-health" aria-label={`${view.health} of 3 health`}><span>Health</span>{[0,1,2].map(n=><i key={n} className={n<view.health?'full':''}/>)}</div><div className="roof-progress"><span>{levels[view.level].name} · {Math.floor(view.progress*100)}%</span><progress value={view.progress} max={1} aria-label="Level progress"/></div><div className={`roof-danger ${view.gap<95?'close':''}`}><span>{view.gap<95?'Pursuer close!':'Chase gap'}</span><strong>{Math.max(0,Math.round(view.gap/10))} m</strong></div><div className="roof-flow"><span>Flow</span><strong>×{view.flow}</strong></div></div>}
   {active&&view.checkpoint>0&&<span className="roof-checkpoint">Checkpoint {view.checkpoint} saved</span>}
   {view.loading<1&&<div className="roof-overlay roof-loading" role="status"><h1>{view.loading<0?'Assets could not load':'Opening the rooftops'}</h1>{view.loading<0?<><p>{view.reason}</p><button onClick={()=>location.reload()}>Reload</button></>:<><progress max={1} value={view.loading}/><p>{Math.floor(view.loading*100)}%</p></>}</div>}
   {view.loading===1&&!active&&<div className={`roof-overlay ${menu?'roof-start':''}`}>
    <div ref={menuRef} className="roof-menu" onKeyDown={e=>{if(e.key!=='Tab')return;const buttons=menuRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}} role={menu?undefined:'dialog'} aria-modal={menu?undefined:true} aria-label={menu?'Start Rooftop Escape':view.phase==='paused'?'Game paused':done?'Escape complete':'Run ended'}>
     <h1>{menu?'Rooftop Escape':view.phase==='paused'?'Take a breath.':done?(view.level===2?'You made it out.':'A little further.'): 'One more run.'}</h1>
     <p>{menu?'Run the skyline. Break through. Stay one rooftop ahead.':view.phase==='paused'?'Your escape is waiting.':done?(view.level===2?'The skyline is yours. All three routes escaped.':'Another district lies ahead.'):view.reason}</p>
     {menu&&<p className="roof-intro">Automatic running. Three controls. No second to waste.</p>}
     {done&&<div className="roof-results"><span>Score <strong>{view.score.toLocaleString()}</strong></span><span>Best <strong>{prefs.best[view.level].toLocaleString()}</strong></span><span>Time <strong>{Math.floor(view.time)}s</strong></span></div>}
     {select?<div className="roof-levels">{levels.map((l,i)=><button key={l.name} disabled={i>prefs.unlocked} onClick={()=>begin(i)}><span>{l.name}</span><small>{i>prefs.unlocked?'Complete the previous route':prefs.best[i]?`Best ${prefs.best[i].toLocaleString()}`:l.subtitle}</small></button>)}<button onClick={()=>setSelect(false)}>Back</button></div>:<div className="roof-actions">
      {menu?<><button className="roof-primary" onClick={()=>begin(0)}>Start escape →</button><button onClick={()=>setSelect(true)}>Choose level</button></>:view.phase==='paused'?<><button className="roof-primary" onClick={()=>scene.current?.resume()}>Keep running →</button><button onClick={()=>scene.current?.retry()}>Restart checkpoint</button><button onClick={()=>{if(scene.current){scene.current.run.phase='menu';scene.current.clearInput();}setSelect(true);}}>Choose level</button></>:done?<><button className="roof-primary" onClick={()=>begin(Math.min(2,view.level+1))}>{view.level===2?'Run Last Rooftop again':'Next rooftop →'}</button><button onClick={()=>setSelect(true)}>Choose level</button></>:<><button className="roof-primary" onClick={()=>scene.current?.retry()}>Retry checkpoint →</button><button onClick={()=>setSelect(true)}>Choose level</button></>}
     </div>}
     {(menu||view.phase==='paused')&&<label className="roof-motion"><input type="checkbox" checked={prefs.reduced} onChange={e=>setPrefs(p=>({...p,reduced:e.target.checked}))}/>Reduced effects</label>}
     {menu&&<p className="roof-key-guide"><b>Space / ↑</b> Jump & hold · <b>S / ↓</b> Slide · <b>J / X</b> Attack</p>}
    </div>
   </div>}
  </div>
  <div className="roof-controls"><p><b>Space / ↑</b> Jump & hold <b>S / ↓</b> Slide <b>J / X</b> Attack <b>R</b> Retry <b>Esc</b> Pause</p><div className="roof-touch" aria-label="Touch controls">{(['jump','slide','attack'] as const).map(key=><button key={key} {...touch(key)} disabled={!active} aria-label={key==='jump'?'Jump, hold for height':key==='slide'?'Slide under barriers':'Contextual attack'}>{key==='jump'?'Jump ↑':key==='slide'?'Slide ↓':'Attack'}</button>)}</div><span>{view.score.toLocaleString()} points</span></div>
 </section>;
}
