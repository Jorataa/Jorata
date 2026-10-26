import {type AnchorHTMLAttributes,type ReactNode} from 'react';
export type Page='home'|'play'|'games'|'surgery'|'rooftop'|'boxing'|'drive'|'notes'|'settings'|'missing';
export const routes:Record<string,Page>={'/':'home','/play':'play','/games':'games','/games/surgery':'surgery','/games/rooftop-escape':'rooftop','/games/boxing':'boxing','/boxing':'boxing','/games/endless-drive':'drive','/notes':'notes','/settings':'settings'};
export const pagePath=(page:Page)=>page==='home'?'/':page==='surgery'?'/games/surgery':page==='rooftop'?'/games/rooftop-escape':page==='boxing'?'/games/boxing':page==='drive'?'/games/endless-drive':`/${page}`;
export type Navigate=(page:Page)=>void;
export function AppLink({to,navigate,children,...props}:Omit<AnchorHTMLAttributes<HTMLAnchorElement>,'href'> & {to:Page;navigate:Navigate;children:ReactNode}){
 return <a {...props} href={pagePath(to)} onClick={event=>{props.onClick?.(event);if(!event.defaultPrevented&&(!props.target||props.target==='_self')&&event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigate(to);}}}>{children}</a>;
}
export function Icon({name,size=18}:{name:string;size?:number}){
 const icons:Record<string,ReactNode>={
 home:<path d="M4 11V21H10V15H14V21H20V11M2 11L12 3L22 11"/>,
 play:<path d="M7 4L20 12L7 20Z"/>,
 games:<path d="M8 4H16V7H20V17H16V20H8V17H4V7H8ZM8 10V14M6 12H10M15 11H17M17 14H19"/>,
 controller:<path d="M6 7H18V9H20L22 19H16L14 16H10L8 19H2L4 9H6ZM7 10V14M5 12H9M15 11H17M17 14H19"/>,
 notes:<path d="M5 3H17L21 7V21H5ZM17 3V7H21M9 11H17M9 15H17M9 18H13"/>,
 document:<path d="M6 3H16L20 7V21H6ZM16 3V7H20M10 11H16M10 15H16"/>,
 folder:<path d="M3 5H9L12 8H21V20H3Z"/>,
 library:<path d="M4 5V21H9V5ZM12 3V21H17V3ZM20 7V21"/>,
 grid:<path d="M3 3H9V9H3ZM15 3H21V9H15ZM3 15H9V21H3ZM15 15H21V21H15Z"/>,
 list:<path d="M3 5H5M9 5H21M3 12H5M9 12H21M3 19H5M9 19H21"/>,
 favorite:<path d="M12 20L3 11V6H9L12 9L15 6H21V11Z"/>,
 robot:<path d="M12 2V5M5 5H19V8H21V18H18V21H6V18H3V8H5ZM8 10V13M16 10V13M9 17H15"/>,
 arrow:<path d="M4 12H20M14 6L20 12L14 18"/>,
 back:<path d="M20 12H4M10 6L4 12L10 18"/>,
 plus:<path d="M12 5V19M5 12H19"/>,
 search:<path d="M4 4H14V6H16V14H14V16H6V14H4ZM16 16L21 21"/>,
 pause:<path d="M8 5V19M16 5V19"/>,
 resume:<path d="M8 4L20 12L8 20Z"/>,
 close:<path d="M5 5L19 19M19 5L5 19"/>,
 lock:<><rect x="5" y="10" width="14" height="11"/><path d="M8 10V6H16V10M12 15V17"/></>,
 settings:<path d="M9 3H15V6H18V9H21V15H18V18H15V21H9V18H6V15H3V9H6V6H9ZM9 9H15V15H9Z"/>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">{icons[name]??icons.settings}</svg>;
}
export function PageHeader({title,description,children}:{title:string;description:string;children?:ReactNode}){return <header className="ui-page-header"><div><h1>{title}</h1><p>{description}</p></div>{children&&<div className="ui-header-actions">{children}</div>}</header>;}
export function Loading({text}:{text:string}){return <div className="loading" role="status"><span className="loading-mark" aria-hidden="true"/>{text}</div>;}
export function LocalNote(){return <span className="ui-local-note"><Icon name="lock" size={14}/>Saved on this device</span>;}
