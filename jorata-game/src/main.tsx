import React,{Suspense,lazy,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AppLink,Icon,Loading,routes,pagePath,type Page} from './ui';
import Home from './Home';
import Games from './Games';
import Settings from './Settings';
import Cursor from './motion/Cursor';
import {MotionContext,useMotionPreference} from './motion/preferences';
import {isWebsite,useSiteMotion} from './motion/useSiteMotion';
import './product.css';
import './website.css';
import './surgery/surgery.css';
import './boxing/boxing.css';
import './motion/motion.css';
const Drive=lazy(()=>import('./drive/Drive'));
const Rooftop=lazy(()=>import('./rooftop/Rooftop'));
const Surgery=lazy(()=>import('./surgery/Surgery'));
const Boxing=lazy(()=>import('./boxing/Boxing'));
const Play=lazy(()=>import('./play/Play'));
const Notes=lazy(()=>import('./notes/Notes'));
const QuickNote=lazy(()=>import('./notes/Notes').then(m=>({default:m.QuickNote})));
function preference(key:string){try{return localStorage.getItem(key)!=='off';}catch{return true;}}
function savePreference(key:string,value:boolean){try{localStorage.setItem(key,value?'on':'off');}catch{/* Preferences never block the product. */}}
class Boundary extends React.Component<{children:React.ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<div className="ui-empty"><h1>This space couldn’t open.</h1><p>Your saved data is still on this device.</p><button className="ui-button ui-button-primary" onClick={()=>location.reload()}>Try again</button></div>:this.props.children;}}
const titles:Record<Page,string>={home:'Home',games:'Games',play:'Mosslight',surgery:'Surgery Simulator',rooftop:'Rooftop Escape',boxing:'Ringcraft Boxing',drive:'Endless Drive',notes:'Notes',settings:'Settings',missing:'Page not found'};
function App(){
 const [page,setPage]=useState<Page>(()=>routes[location.pathname]??'missing');
 const [quick,setQuick]=useState(false),[motion,setMotion]=useState(()=>preference('jorata-motion')),[cursor,setCursor]=useState(()=>preference('jorata-cursor')),[noteId,setNoteId]=useState('');
 const effects=useMotionPreference(motion);
 useSiteMotion(effects,page);
 const closeQuick=()=>{const panel=document.querySelector<HTMLElement>(".jn-quick");if(effects&&panel?.animate){const animation=panel.animate([{opacity:1,scale:"1"},{opacity:0,scale:".985"}],{duration:120,easing:"ease-in"});void animation.finished.then(()=>setQuick(false),()=>setQuick(false));}else setQuick(false);};
 const navigate=(next:Page)=>{history.pushState(null,'',pagePath(next));setPage(next);window.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(()=>document.getElementById('main')?.focus({preventScroll:true}));};
 useEffect(()=>{const pop=()=>setPage(routes[location.pathname]??'missing');window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 useEffect(()=>{document.title=`${titles[page]} · Jorata`;},[page]);
 useEffect(()=>{document.documentElement.dataset.motion=motion?'on':'off';savePreference('jorata-motion',motion);},[motion]);
 useEffect(()=>{savePreference('jorata-cursor',cursor);},[cursor]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='j'){e.preventDefault();if(quick)closeQuick();else setQuick(true);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[quick,effects]);
 return <MotionContext.Provider value={effects}><Boundary><div className={`product page-${page}`} data-site-motion={isWebsite(page)?'true':undefined}><a className="skip" href="#main">Skip to content</a><header className="masthead"><AppLink to="home" navigate={navigate} className="brand" aria-label="JORATA home"><img src="/brand/jorata_emblem.svg" alt="" width={28} height={28}/><span translate="no">JORATA</span></AppLink><nav className="dock" aria-label="Main navigation"><span className="nav-tracker" aria-hidden="true"/>{(['home','games','notes','settings'] as const).map(p=><AppLink key={p} to={p} navigate={navigate} aria-current={page===p||(p==='games'&&(page==='play'||page==='surgery'||page==='rooftop'||page==='boxing'||page==='drive'))?'page':undefined}><Icon name={p}/><span>{p[0].toUpperCase()+p.slice(1)}</span></AppLink>)}</nav><div className="header-actions"><button className="motion-toggle" aria-label={motion?'Pause interface motion':'Resume interface motion'} aria-pressed={!motion} title={motion?'Pause motion':'Resume motion'} onClick={()=>setMotion(!motion)}><Icon name={motion?'pause':'resume'} size={16}/></button><button className="quick-launch ui-button ui-button-secondary" onClick={()=>setQuick(true)}><Icon name="plus" size={16}/><span>Quick note</span><kbd>⌘ J</kbd></button></div></header>
 <main id="main" tabIndex={-1} key={page} className="page-content">
 {page==='home'?<Home navigate={navigate} onNote={id=>{setNoteId(id);navigate('notes');}} onNew={()=>setQuick(true)}/>:page==='games'?<Games navigate={navigate}/>:page==='play'?<Suspense fallback={<Loading text="Opening Mosslight…"/>}><Play onQuickNote={()=>setQuick(true)} reducedMotion={!motion} paused={quick}/></Suspense>:page==='surgery'?<Suspense fallback={<Loading text="Opening Surgery Simulator…"/>}><Surgery onExit={()=>navigate('games')} reducedMotion={!motion} paused={quick}/></Suspense>:page==='rooftop'?<Suspense fallback={<Loading text="Opening Rooftop Escape…"/>}><Rooftop onExit={()=>navigate('games')} reducedMotion={!motion} paused={quick}/></Suspense>:page==='boxing'?<Suspense fallback={<Loading text="Entering the ring…"/>}><Boxing onExit={()=>navigate('games')} reducedMotion={!motion} paused={quick}/></Suspense>:page==='drive'?<Suspense fallback={<Loading text="Opening Endless Drive…"/>}><Drive onExit={()=>navigate('games')} reducedMotion={!motion} paused={quick}/></Suspense>:page==='notes'?<Suspense fallback={<Loading text="Opening your notebook…"/>}><Notes initialNoteId={noteId}/></Suspense>:page==='settings'?<Settings motion={motion} cursor={cursor} setMotion={setMotion} setCursor={setCursor}/>:<section className="ui-empty"><h1>This path ends here.</h1><p>Find your way back to your world or notebook.</p><AppLink className="ui-button ui-button-primary" to="home" navigate={navigate}>Return home<Icon name="arrow"/></AppLink></section>}
 </main>{quick&&<div className="quick-host"><Suspense fallback={<Loading text="Opening quick note…"/>}><QuickNote onClose={closeQuick}/></Suspense></div>}<Cursor key={`cursor-${page}`} enabled={effects&&cursor&&isWebsite(page)}/></div></Boundary></MotionContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<App/>);
