import {Suspense,lazy} from 'react';
import {AppLink,Icon,LocalNote,type Navigate} from './ui';
import GameCard,{gameLibrary} from './ui/GameCard';
const RecentNotes=lazy(()=>import('./recent'));
export default function Home({navigate,onNote,onNew}:{navigate:Navigate;onNote:(id:string)=>void;onNew:()=>void}){
 return <div className="home-page"><header className="home-intro"><div><h1>A little world.<br/>Endless possibility.</h1><p>A place to play, make something, and keep a thought.</p></div><AppLink className="ui-button ui-button-secondary" to="games" navigate={navigate}>Browse games<Icon name="arrow" size={16}/></AppLink></header><section className="home-games" aria-label="Find your next little adventure"><GameCard game={gameLibrary[0]} navigate={navigate} featured/><GameCard game={gameLibrary[1]} navigate={navigate}/></section><section className="home-bottom"><div className="notes-intro"><Icon name="notes" size={22}/><h2>Leave room for a thought.</h2><p>Ideas from your world. Or somewhere else entirely.</p><AppLink className="text-action" to="notes" navigate={navigate}>Open your notebook<Icon name="arrow" size={16}/></AppLink></div><Suspense fallback={<p role="status">Opening recent notes…</p>}><RecentNotes onOpen={onNote} onNew={onNew}/></Suspense></section><footer className="site-footer"><span>Play. Create. Remember.</span><LocalNote/></footer></div>;
}
