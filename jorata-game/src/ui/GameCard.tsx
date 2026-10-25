import {AppLink,Icon,type Navigate,type Page} from './index';
import {Landscape} from './Landscape';
import {cases} from '../surgery/data';
export const gameLibrary=[
 {id:'mosslight',title:'Mosslight',category:'Sandbox',description:'A quiet world, shaped by you. Gather, build, and follow your curiosity.',detail:'Explore at your own pace',to:'play' as Page,action:'Enter Mosslight',tags:['build','explore','world']},
 {id:'surgery',title:'Surgery Simulator',category:'Simulation',description:'Learn the tools. Read the monitor. Bring your patient home.',detail:`${cases.length} diseases · No locked cases`,to:'surgery' as Page,action:'Play Surgery',tags:['patient','medical','diseases']},
 {id:'boxing',title:'Ringcraft Boxing',category:'Sports',description:'Two fighters on one shared keyboard, or solo against AI. Four keys each with automatic jab, hook, and uppercut combos.',detail:'Local 1v1 · Single Player vs AI',to:'boxing' as Page,action:'Play Boxing',tags:['boxing','multiplayer','1v1','shared keyboard','combat']},
];
export type Game=typeof gameLibrary[number];
function BoxingCover(){
 return <div className="b-cover-scene" aria-hidden="true"><img src="/boxing/backgrounds/ring/ring_background_full.png" alt="" className="b-cover-bg" width={1536} height={351}/><div className="b-cover-fighters"><img src="/boxing/characters/player_red/jab_02.png" alt="" className="b-cover-fighter" width={160} height={160}/><img src="/boxing/ui/versus.png" alt="" className="b-cover-vs" width={56} height={40}/><img src="/boxing/characters/player_blue/hook_02.png" alt="" className="b-cover-fighter b-cover-fighter-blue" width={160} height={160}/></div></div>;
}
export default function GameCard({game,navigate,featured=false}:{game:Game;navigate:Navigate;featured?:boolean}){
 return <article className={`game-card ${featured?'game-card-featured':''}`}><AppLink to={game.to} navigate={navigate} className={`game-cover game-cover-${game.id}`} aria-label={`Open ${game.title}`}>{game.id==='mosslight'?<Landscape/>:game.id==='surgery'?<img src="/surgery/healthy.png" alt="The original Jorata pixel patient, ready for treatment" width={886} height={538}/>:<BoxingCover/>}<span className="game-open" aria-hidden="true"><Icon name="arrow"/></span></AppLink><div className="game-card-content"><div className="game-title-row"><h2>{game.title}</h2><span>{game.category}</span></div><p>{game.description}</p><div className="game-card-bottom"><span>{game.detail}</span><AppLink to={game.to} navigate={navigate} className={featured?'ui-button ui-button-primary magnetic':'ui-button ui-button-secondary'}>{game.action}<Icon name="arrow" size={16}/></AppLink></div></div></article>;
}
