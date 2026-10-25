import {useEffect,useRef,useState} from 'react';
export type PatientMood='healthy'|'pain'|'fear'|'critical'|'death';
const clips={healthy:'01_healthy',pain:'02_pain',fear:'09_fear',critical:'03_dying_to_dead',death:'03_dying_to_dead'};
export default function Patient({mood,quiet=false}:{mood:PatientMood;quiet?:boolean}){
 const refs=useRef<Partial<Record<PatientMood,HTMLVideoElement>>>({});const [failed,setFailed]=useState(false);
 const configure=(v:HTMLVideoElement,key:PatientMood)=>{v.pause();if(key!==mood)return;const still=quiet||matchMedia('(prefers-reduced-motion: reduce)').matches;v.currentTime=key==='critical'?1.35:key==='death'?(still?6.2:2.8):0;if(!still)void v.play().catch(()=>{});};
 useEffect(()=>{const motion=matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>Object.entries(refs.current).forEach(([key,v])=>{if(v)configure(v,key as PatientMood);});sync();motion.addEventListener('change',sync);return()=>{motion.removeEventListener('change',sync);Object.values(refs.current).forEach(v=>v?.pause());};},[mood,quiet]);
 return <div className="s-patient" data-mood={mood} role="img" aria-label={`Pixel patient in a fixed hospital bed: ${mood}`}>
 <img className="s-patient-base" src="/surgery/bed.png" alt="" aria-hidden="true"/><div className="s-patient-crop">
 {(['healthy','pain','fear','critical','death'] as PatientMood[]).map(key=><video key={key} data-clip={key} ref={v=>{if(v)refs.current[key]=v;}} className={mood===key?'visible':''} src={`/surgery/surgery_patient_${clips[key]}.mp4`} poster={`/surgery/${key}.png`} muted playsInline preload={key===mood?'auto':'metadata'} loop={key!=='critical'&&key!=='death'} aria-hidden="true" onLoadedData={e=>configure(e.currentTarget,key)} onTimeUpdate={e=>{if(key==='critical'&&e.currentTarget.currentTime>=2.5)e.currentTarget.currentTime=1.35;}} onError={()=>setFailed(true)}/>)}
 {failed&&<img src={`/surgery/${mood}.png`} alt={`Patient ${mood}`} className="s-patient-fallback" data-clip={mood}/>}
 </div></div>;
}
