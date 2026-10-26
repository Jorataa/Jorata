import {Suspense,lazy} from 'react';
import {AppLink,Icon,LocalNote,type Navigate} from './ui';
import GameCard,{gameLibrary} from './ui/GameCard';
const RecentNotes=lazy(()=>import('./recent'));

export default function Home({navigate,onNote,onNew}:{navigate:Navigate;onNote:(id:string)=>void;onNew:()=>void}){
 return <div className="home-page">
  <section className="world-invitation" aria-labelledby="world-title">
   <picture className="invitation-art"><source media="(max-width:600px)" srcSet="/brand/hero_bg_mobile.webp"/><img src="/brand/hero_bg_main.webp" width={1536} height={1024} alt="A moonlit pixel city with warm windows and rooftop gardens" fetchPriority="high"/></picture>
   <div className="invitation-copy"><h1 id="world-title">Find your<br/>next world.</h1><p>Five games to get lost in.<br/>A notebook to bring something back.</p><AppLink to="games" navigate={navigate} className="ui-button ui-button-primary"><span>Explore games</span><Icon name="arrow" size={18}/></AppLink><span className="invitation-detail">Play in your browser. Make yourself at home.</span></div>
  </section>
  <section className="home-discovery" aria-labelledby="discovery-title"><header className="discovery-heading"><h2 id="discovery-title">A little escape.</h2><AppLink to="games" navigate={navigate} className="text-action">All {gameLibrary.length} games<Icon name="arrow" size={16}/></AppLink></header><div className="home-games">{[gameLibrary[0],gameLibrary[2],gameLibrary[3]].map(game=><GameCard key={game.id} game={game} navigate={navigate} compact/>)}</div></section>
  <section className="home-bottom" aria-labelledby="notebook-title"><div className="notes-intro"><h2 id="notebook-title">Keep the thought.</h2><p>A strategy, a story, something for later.<br/>Your notebook is right here.</p><AppLink className="text-action" to="notes" navigate={navigate}>Open your notebook<Icon name="arrow" size={16}/></AppLink></div><Suspense fallback={<p role="status">Opening recent notes…</p>}><RecentNotes onOpen={onNote} onNew={onNew}/></Suspense></section>
  <footer className="site-footer"><span>JORATA · Play. Create. Remember.</span><LocalNote/></footer>
 </div>;
}
