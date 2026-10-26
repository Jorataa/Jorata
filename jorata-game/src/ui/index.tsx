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
 home:<><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></>,
 play:<><path d="m12 3 9 5v9l-9 5-9-5V8z"/><path d="m3 8 9 5 9-5M12 13v9"/></>,
 games:<><path d="M7 6h10c3 0 5 11 4 13s-3 0-6-3H9c-3 3-5 5-6 3S4 6 7 6Z"/><path d="M7 9v5m-2.5-2.5h5M16 10h.1M18 13h.1"/></>,
 notes:<><path d="M5 3h14v18H5zM9 8h6M9 12h6M9 16h4"/></>,
 arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
 plus:<path d="M12 5v14M5 12h14"/>,
 search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 pause:<><path d="M8 5v14M16 5v14"/></>,
 resume:<path d="m8 4 12 8-12 8Z"/>,
 close:<path d="m6 6 12 12M6 18 18 6"/>,
 lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
 settings:<><path d="m12 3 2 3 4 1 1 4 2 2-2 2-1 4-4 1-2 2-2-2-4-1-1-4-2-2 2-2 1-4 4-1z"/><circle cx="12" cy="13" r="3"/></>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]??icons.settings}</svg>;
}
export function PageHeader({title,description,children}:{title:string;description:string;children?:ReactNode}){return <header className="ui-page-header"><div><h1>{title}</h1><p>{description}</p></div>{children&&<div className="ui-header-actions">{children}</div>}</header>;}
export function Loading({text}:{text:string}){return <div className="loading" role="status"><span className="loading-mark" aria-hidden="true"/>{text}</div>;}
export function LocalNote(){return <span className="ui-local-note"><Icon name="lock" size={14}/>Saved on this device</span>;}
