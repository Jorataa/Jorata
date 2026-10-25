import {useState} from 'react';
import { toolById, type ToolId } from './data';
const paths:Record<string,React.ReactNode>={
 scan:<><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M6 11h3l2-4 3 6 2-3h2M8 21h8m-4-5v5"/></>,
 syringe:<><path d="m7 3 14 14M5 7l12 12 3-3L8 4M3 21l4-4m-3-3 6 6M14 4l6 6"/></>,
 bottle:<><path d="M9 3h6v4l3 3v11H6V10l3-3zM6 12h12M10 16h4m-2-2v4"/></>,
 blade:<><path d="m4 21 8-8m-2-2L20 2c3 5-1 10-6 13zM2 19l3 3"/></>,
 stitch:<><path d="M4 5c16 0 16 14 4 14H4M7 2v6m5-5-2 6m7-3-4 4m7 1-6 2m5 4-6-1M2 19l3-2v4z"/></>,
 splint:<><path d="m7 3 10 18M14 3 4 21M5 7h11M3 15h15M2 21h5m8 0h5"/></>,
 pins:<><path d="M5 3v18m7-18v18m7-18v18M2 5h6m1 0h6m1 0h6"/></>,
 clamp:<><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="m8 15 9-12M16 15 7 3M10 12h4"/></>,
 sponge:<><path d="M4 7c0-3 5-5 8-3 4-2 8 0 8 4v10c0 3-5 4-8 2-4 2-8 1-8-2zM8 9h1m6 0h1m-5 5h1m-4 3h1m7-2h1"/></>,
 capsule:<><path d="m8 4-4 4a6 6 0 0 0 8 8l4-4A6 6 0 0 0 8 4ZM6 6l8 8"/><path d="m17 14 4 4m-4 0 4-4"/></>,
 lab:<><path d="M9 3h6m-5 0v7l-6 9c-1 2 0 2 2 2h12c2 0 3 0 2-2l-6-9V3M7 15h10M10 18h1"/></>,
 bag:<><path d="M8 3h8l3 4v11H5V7zM12 18v4m-3-12h6m-3-3v6"/></>,
 bolt:<><path d="m14 2-9 12h6l-1 8 9-13h-6z"/></>,
 fix:<><path d="m14 5 4 4 3-3c1 6-2 9-7 7L6 21l-3-3 8-8c-2-5 1-8 6-7z"/></>,
};
// Match the functional game IDs to the original, unmodified uploads.
export const surgeryToolAssets: Partial<Record<ToolId, string>> = {
 ultrasound: 'ultrasound.png', anesthetic: 'anesthetic.png', antiseptic: 'antiseptic.png',
 scalpel: 'scalpel.png', stitches: 'suture.png', clamp: 'clamp.png', sponge: 'gauze.png',
 antibiotics: 'antibiotic.png', transfusion: 'blood_transfusion.png', defibrillator: 'defibrillator.png',
};
export default function SurgeryToolIcon({id}:{id:ToolId}) {
 const [failedSource,setFailedSource]=useState<string|null>(null);
 const file=surgeryToolAssets[id];
 const src=file?`/surgery/tools/${file}`:undefined;
 return <span className="s-tool-icon" data-tool={id} data-fallback={!src||failedSource===src?true:undefined} aria-hidden="true">
 {src&&failedSource!==src?<img src={src} alt="" width="256" height="256" draggable={false} onError={()=>setFailedSource(src)}/>:<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{paths[toolById(id).glyph]}</svg>}
 </span>;
}
