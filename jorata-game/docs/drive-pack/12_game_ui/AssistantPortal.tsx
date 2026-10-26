import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import './hud.css';
/** Supply the existing Jorata robot image. No robot redesign or invented AI functionality. */
export function AssistantPortal({image,onOpen,avoidControls=false}:{image:string;onOpen:()=>void;avoidControls?:boolean}){
 const [mounted,setMounted]=useState(false),[collapsed,setCollapsed]=useState(false);
 useEffect(()=>{setMounted(true);return ()=>setMounted(false);},[]);
 if(!mounted)return null;
 return createPortal(<aside className={'jorata-assistant'+(avoidControls?' avoid-controls':'')} aria-label="Jorata assistant">
  <button className="jorata-assistant-collapse" aria-label={collapsed?'Expand assistant':'Collapse assistant'} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'+':'−'}</button>
  {!collapsed&&<button className="jorata-assistant-main" onClick={onOpen} aria-label="Ask Jorata assistant"><img src={image} alt="Jorata robot"/></button>}
 </aside>,document.body);
}
