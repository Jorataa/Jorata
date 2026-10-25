import React,{Suspense,lazy,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AppLink,Icon,Loading,routes,pagePath,type Page} from './ui';
import Home from './Home';
import Games from './Games';
import Settings from './Settings';
import {useInteractions} from './interactions';
import './product.css';
import './surgery/surgery.css';
import './boxing/boxing.css';
const Surgery=lazy(()=>import('./surgery/Surgery'));
const Boxing=lazy(()=>import('./boxing/Boxing'));
const Play=lazy(()=>import('./play/Play'));
const Notes=lazy(()=>import('./notes/Notes'));
const QuickNote=lazy(()=>import('./notes/Notes').then(m=>({default:m.QuickNote})));
function preference(key:string){try{return localStorage.getItem(key)!=='off';}catch{return true;}}
function savePreference(key:string,value:boolean){try{localStorage.setItem(key,value?'on':'off');}catch{/* Preferences never block the product. */}}
class Boundary extends React.Component<{children:React.ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<div className="ui-empty"><h1>This space couldn’t open.</h1><p>Your saved data is still on this device.</p><button className="ui-button ui-button-primary" onClick={()=>location.reload()}>Try again</button></div>:this.props.children;}}
const titles:Record<Page,string>={home:'Home',games:'Games',play:'Mosslight',surgery:'Surgery Simulator',boxing:'Ringcraft Boxing',notes:'Notes',settings:'Settings',missing:'Page not found'};
function App(){
 const [page,setPage]=useState<Page>(()=>routes[location.pathname]??'missing');
 const [quick,setQuick]=useState(false),[motion,setMotion]=useState(()=>preference('jorata-motion')),[cursor,setCursor]=useState(()=>preference('jorata-cursor')),[noteId,setNoteId]=useState('');
 useInteractions(motion);
 const navigate=(next:Page)=>{history.pushState(null,'',pagePath(next));setPage(next);window.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(()=>document.getElementById('main')?.focus({preventScroll:true}));};
 useEffect(()=>{const pop=()=>setPage(routes[location.pathname]??'missing');window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 useEffect(()=>{document.title=`${titles[page]} · Jorata`;},[page]);
 useEffect(()=>{document.documentElement.dataset.motion=motion?'on':'off';savePreference('jorata-motion',motion);},[motion]);
 useEffect(()=>{savePreference('jorata-cursor',cursor);const el=document.querySelector<HTMLElement>('.cursor-ring');if(!el||!cursor||!motion)return;const reduce=matchMedia('(prefers-reduced-motion:reduce)'),fine=matchMedia('(pointer:fine)');const hide=()=>{el.style.opacity='0';};const move=(e:PointerEvent)=>{if(reduce.matches||!fine.matches||!(e.target as HTMLElement).closest('.game-cover,.s-apply-zone')){hide();return;}el.style.opacity='.65';el.style.transform=`translate3d(${e.clientX}px,${e.clientY}px,0)`;};window.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',hide);reduce.addEventListener('change',hide);return()=>{hide();window.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',hide);reduce.removeEventListener('change',hide);};},[cursor,motion]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='j'){e.preventDefault();setQuick(q=>!q);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 return <Boundary><div className={`product page-${page}`}><a className="skip" href="#main">Skip to content</a><header className="masthead"><AppLink to="home" navigate={navigate} className="brand" aria-label="JORATA home"><svg width="25" height="28" viewBox="0 0 27 31" fill="none" aria-hidden="true"><path d="M3 5h21v13L13.5 27 3 18V5Z" stroke="currentColor" strokeWidth="1.5"/><path d="M9 11h9v7l-4.5 4L9 18z" fill="currentColor"/></svg><span translate="no">JORATA</span></AppLink><nav className="dock" aria-label="Main navigation">{(['home','games','play','notes','settings'] as const).map(p=><AppLink key={p} to={p} navigate={navigate} aria-current={page===p||(p==='games'&&(page==='surgery'||page==='boxing'))?'page':undefined}><Icon name={p}/><span>{p[0].toUpperCase()+p.slice(1)}</span></AppLink>)}</nav><div className="header-actions"><button className="motion-toggle" aria-label={motion?'Pause interface motion':'Resume interface motion'} aria-pressed={!motion} title={motion?'Pause motion':'Resume motion'} onClick={()=>setMotion(!motion)}><Icon name={motion?'pause':'resume'} size={16}/></button><button className="quick-launch ui-button ui-button-secondary" onClick={()=>setQuick(true)}><Icon name="plus" size={16}/><span>Quick note</span><kbd>⌘ J</kbd></button></div></header>
 <main id="main" tabIndex={-1} key={page} className="page-content">
 {page==='home'?<Home navigate={navigate} onNote={id=>{setNoteId(id);navigate('notes');}} onNew={()=>setQuick(true)}/>:page==='games'?<Games navigate={navigate}/>:page==='play'?<Suspense fallback={<Loading text="Opening Mosslight…"/>}><Play onQuickNote={()=>setQuick(true)} reducedMotion={!motion} paused={quick}/></Suspense>:page==='surgery'?<Suspense fallback={<Loading text="Opening Surgery Simulator…"/>}><Surgery onExit={()=>navigate('games')} reducedMotion={!motion} paused={quick}/></Suspense>:page==='boxing'?<Suspense fallback={<Loading text="Entering the ring…"/>}><Boxing onExit={()=>navigate('games')} reducedMotion={!motion} paused={quick}/></Suspense>:page==='notes'?<Suspense fallback={<Loading text="Opening your notebook…"/>}><Notes initialNoteId={noteId}/></Suspense>:page==='settings'?<Settings motion={motion} cursor={cursor} setMotion={setMotion} setCursor={setCursor}/>:<section className="ui-empty"><h1>This path ends here.</h1><p>Find your way back to your world or notebook.</p><AppLink className="ui-button ui-button-primary" to="home" navigate={navigate}>Return home<Icon name="arrow"/></AppLink></section>}
 </main>{quick&&<div className="quick-host"><Suspense fallback={<Loading text="Opening quick note…"/>}><QuickNote onClose={()=>setQuick(false)}/></Suspense></div>}<div className="cursor-ring" aria-hidden="true"/></div></Boundary>;
}
createRoot(document.getElementById('root')!).render(<App/>);
