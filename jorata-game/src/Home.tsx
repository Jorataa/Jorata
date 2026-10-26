import {Suspense,lazy,useRef} from 'react';
import {AppLink,Icon,LocalNote,type Navigate} from './ui';
import GameCard,{gameLibrary} from './ui/GameCard';
const RecentNotes=lazy(()=>import('./recent'));

export default function Home({navigate,onNote,onNew}:{navigate:Navigate;onNote:(id:string)=>void;onNew:()=>void}){
 const carouselRef=useRef<HTMLDivElement>(null);
 const scrollCarousel=(dir:number)=>{
  const el=carouselRef.current;if(!el)return;
  const step=Math.max(280,Math.round(el.clientWidth*.72));
  el.scrollBy({left:dir*step,behavior:document.documentElement.dataset.motion==='off'?'auto':'smooth'});
 };
 const scrollToCard=(idx:number)=>{
  const el=carouselRef.current;if(!el)return;
  const cards=el.querySelectorAll<HTMLElement>('.game-card');
  if(cards[idx]){
   const targetLeft=cards[idx].offsetLeft-el.offsetLeft;
   el.scrollTo({left:targetLeft,behavior:document.documentElement.dataset.motion==='off'?'auto':'smooth'});
  }
 };
 return <div className="home-page">
  <section className="world-invitation" aria-labelledby="world-title">
   <picture className="invitation-art"><source media="(max-width:600px)" srcSet="/brand/hero_bg_mobile.webp"/><img src="/brand/hero_bg_main.webp" width={1536} height={1024} alt="A moonlit pixel city with warm windows and rooftop gardens" fetchPriority="high"/></picture>
   <div className="invitation-atmosphere" aria-hidden="true">
    <img className="hero-ambient-glow" src="/brand/overlays/hero_ambient_overlay.svg" alt="" width={1536} height={1024}/>
    <img className="hero-cloud-wisp" src="/brand/decorations/cloud_wisp.svg" alt="" width={640} height={128}/>
    <img className="hero-glass-highlight" src="/brand/overlays/glass_highlight.svg" alt="" width={640} height={420}/>
    <img className="hero-star hero-star-1" src="/brand/decorations/particle_gold.svg" alt="" width={16} height={16}/>
    <img className="hero-star hero-star-2" src="/brand/decorations/particle_mint.svg" alt="" width={16} height={16}/>
    <img className="hero-star hero-star-3" src="/brand/decorations/pixel_star.svg" alt="" width={20} height={20}/>
    <img className="hero-corner-ornament" src="/brand/ui/corner_ornament.svg" alt="" width={48} height={48}/>
   </div>
   <div className="invitation-copy">
    <span className="invitation-eyebrow"><img src="/brand/jorata_emblem.svg" alt="" width={16} height={16}/><span>PIXEL GAMING PLATFORM · 5 WORLDS</span></span>
    <h1 id="world-title">Find your<br/>next world.</h1>
    <p>Five games to get lost in.<br/>A notebook to bring something back.</p>
    <div className="invitation-actions">
     <AppLink to="games" navigate={navigate} className="ui-button ui-button-primary"><span>Explore games</span><Icon name="arrow" size={18}/></AppLink>
     <AppLink to="play" navigate={navigate} className="ui-button ui-button-hero-secondary"><Icon name="play" size={16}/><span>Enter Mosslight</span></AppLink>
    </div>
    <span className="invitation-detail">Play in your browser. Make yourself at home.</span>
   </div>
   <div className="invitation-emblem-stage" aria-hidden="true">
    <div className="invitation-emblem-card">
     <div className="hero-status-pill"><span className="pulse-dot"/><span translate="no">SYSTEM ONLINE · 5 WORLDS READY</span></div>
     <img className="invitation-logo-art" src="/brand/logo/jorata_logo_512.png" alt="" width={512} height={341} decoding="async"/>
     <div className="invitation-emblem-meta"><span className="emblem-dot"/><span>Instant Browser Play · Zero Downloads</span></div>
    </div>
   </div>
  </section>
  <section className="home-discovery" aria-labelledby="discovery-title">
   <header className="discovery-heading">
    <div className="discovery-title-block">
     <span className="section-kicker">CURATED WORLDS · DRAG TO EXPLORE</span>
     <h2 id="discovery-title">A little escape.</h2>
    </div>
    <div className="discovery-controls">
     <div className="carousel-nav" role="group" aria-label="Carousel controls">
      <button type="button" className="carousel-btn" aria-label="Scroll games left" onClick={()=>scrollCarousel(-1)}><Icon name="back" size={16}/></button>
      <button type="button" className="carousel-btn" aria-label="Scroll games right" onClick={()=>scrollCarousel(1)}><Icon name="arrow" size={16}/></button>
     </div>
     <AppLink to="games" navigate={navigate} className="text-action">All {gameLibrary.length} games<Icon name="arrow" size={16}/></AppLink>
    </div>
   </header>
   <div ref={carouselRef} className="home-games" data-carousel="games" role="region" aria-label="Featured games">{gameLibrary.map(game=><GameCard key={game.id} game={game} navigate={navigate} compact/>)}</div>
   <div className="carousel-scrub-bar" aria-label="Game library navigation">
    <div className="carousel-track" role="progressbar" aria-label="Carousel scroll position" onClick={e=>{
     const rect=e.currentTarget.getBoundingClientRect();
     const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
     const el=carouselRef.current;
     if(el)el.scrollTo({left:ratio*(el.scrollWidth-el.clientWidth),behavior:document.documentElement.dataset.motion==='off'?'auto':'smooth'});
    }}>
     <div className="carousel-progress-fill"/>
     <div className="carousel-scrub-thumb"/>
    </div>
    <div className="carousel-pills" role="tablist" aria-label="Quick jump to game">
     {gameLibrary.map((g,i)=><button key={g.id} type="button" className="carousel-dot" aria-label={`Jump to ${g.title}`} data-active={i===0?'true':'false'} onClick={()=>scrollToCard(i)}><span>{i+1}</span><small>{g.title}</small></button>)}
    </div>
   </div>
  </section>
  <div className="section-divider" aria-hidden="true"><img src="/brand/ui/section_separator.svg" alt="" width={1200} height={16}/></div>
  <section className="home-bottom" aria-labelledby="notebook-title">
   <img className="notes-bookmark-art" src="/brand/decorations/notes_bookmark.svg" alt="" width={48} height={80} aria-hidden="true"/>
   <div className="notes-intro">
    <div className="notes-companion-pill"><img src="/surgery/assistant/jorata_assistant.png" alt="" width={34} height={34} loading="lazy" decoding="async"/><span>FIELD JOURNAL & COMPANION</span></div>
    <div className="companion-bubble" aria-hidden="true"><p>Field notes stay private on this device.</p></div>
    <h2 id="notebook-title">Keep the thought.</h2>
    <p>A strategy, a story, something for later.<br/>Your notebook is right here.</p>
    <AppLink className="text-action" to="notes" navigate={navigate}>Open your notebook<Icon name="arrow" size={16}/></AppLink>
   </div>
   <Suspense fallback={<p role="status">Opening recent notes…</p>}><RecentNotes onOpen={onNote} onNew={onNew}/></Suspense>
  </section>
  <footer className="site-footer">
   <div className="footer-brand"><img src="/brand/jorata_emblem.svg" alt="" width={22} height={22}/><span>JORATA · Play. Create. Remember.</span></div>
   <div className="footer-right"><img className="footer-antenna" src="/brand/decorations/rooftop_antenna.svg" alt="" width={24} height={48} aria-hidden="true"/><LocalNote/></div>
  </footer>
 </div>;
}
