import {AppLink,Icon,type Navigate,type Page} from './index';
import GamePreview from '../motion/GamePreview';
import {Landscape} from './Landscape';
import {cases} from '../surgery/data';
export const gameLibrary=[
 {id:'mosslight',title:'Mosslight',category:'Sandbox',description:'A quiet world, shaped by you. Gather, build, and follow your curiosity.',detail:'Explore at your own pace',to:'play' as Page,action:'Enter Mosslight',tags:['build','explore','world']},
 {id:'surgery',title:'Surgery Simulator',category:'Simulation',description:'Learn the tools. Read the monitor. Bring your patient home.',detail:`${cases.length} diseases · No locked cases`,to:'surgery' as Page,action:'Play Surgery',tags:['patient','medical','diseases']},
 {id:'boxing',title:'Ringcraft Boxing',category:'Sports',description:'Two fighters on one shared keyboard, or solo against AI. Four keys each with automatic jab, hook, and uppercut combos.',detail:'Local 1v1 · Single Player vs AI',to:'boxing' as Page,action:'Play Boxing',tags:['boxing','multiplayer','1v1','shared keyboard','combat']},
 {id:'rooftop',title:'Rooftop Escape',category:'Action',description:'Run the skyline. Vault barriers, break through guards, and stay one rooftop ahead.',detail:'3 routes · Keyboard & touch',to:'rooftop' as Page,action:'Start escape',tags:['parkour','runner','chase']},
 {id:'drive',title:'Endless Drive',category:'Simulation',description:'Choose a vehicle. Take the long way home. Open hills, alpine roads, and a quiet coast await.',detail:'6 vehicles · 3 landscapes · Endless roads',to:'drive' as Page,action:'Go for a drive',tags:['driving','cars','relax','scenery']},
];
export type Game=typeof gameLibrary[number];
const coverArt:Record<string,{alt:string}>={
 surgery:{alt:'Pixel operating theatre from the supplied Surgery artwork'},
 boxing:{alt:'Two fighters face off under the ring lights'},
 rooftop:{alt:'A runner above the city in the Rooftop Escape artwork'},
};
export default function GameCard({game,navigate,featured=false,compact=false}:{game:Game;navigate:Navigate;featured?:boolean;compact?:boolean}){
 const art=coverArt[game.id];
 return <article className={`game-card ${featured?'game-card-featured':''} ${compact?'game-card-compact':''}`}>
  <AppLink to={game.to} navigate={navigate} className={`game-cover game-cover-${game.id}`} aria-label={`Open ${game.title}`}>
   {art?<img src={`/covers/game_${game.id}_card.webp`} srcSet={`/covers/game_${game.id}_card.webp 768w, /covers/game_${game.id}_landscape.webp 1200w`} sizes={compact?'(max-width:760px) 100vw, 33vw':'(max-width:760px) 100vw, 50vw'} alt={art.alt} width={768} height={512} loading="lazy" decoding="async"/>:game.id==='drive'?<img src="/drive/cover.png" alt="A winding road through the green highlands" width={1200} height={675} loading="lazy" decoding="async"/>:<Landscape/>}
   <GamePreview game={game.id}/><span className="game-open" aria-hidden="true"><Icon name="arrow"/></span>
  </AppLink>
  <div className="game-card-content"><div className="game-title-row"><h2>{game.title}</h2><span>{game.category}</span></div>{!compact&&<p>{game.description}</p>}<div className="game-card-bottom">{!compact&&<span>{game.detail}</span>}<AppLink to={game.to} navigate={navigate} className="game-launch">{game.action}<Icon name="arrow" size={16}/></AppLink></div></div>
 </article>;
}
