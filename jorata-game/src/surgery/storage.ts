import { cases } from './data';
import type { Surgery } from './engine';
export const PROGRESS_KEY='jorata.surgery.progress.v1';
export type Result={id:string;caseId:string;won:boolean;turns:number;mistakes:number;date:string};
export type Progress={version:1;skill:number;completed:number;attempts:number;best:Record<string,number>;history:Result[]};
export const emptyProgress=():Progress=>({version:1,skill:0,completed:0,attempts:0,best:{},history:[]});
export function loadProgress():Progress {try{const p=JSON.parse(localStorage.getItem(PROGRESS_KEY)??'null');if(!p||p.version!==1||!Number.isInteger(p.skill)||p.skill<0||p.skill>100||!Number.isInteger(p.completed)||p.completed<0||!Number.isInteger(p.attempts)||p.attempts<p.completed||!Array.isArray(p.history)||typeof p.best!=='object'||p.best===null)return emptyProgress();return {...p,history:p.history.filter((r:Result)=>r&&typeof r.id==='string'&&cases.some(c=>c.id===r.caseId)&&typeof r.won==='boolean'&&Number.isInteger(r.turns)&&r.turns>0&&typeof r.date==='string').slice(0,100),best:Object.fromEntries(Object.entries(p.best).filter(([id,value])=>cases.some(c=>c.id===id)&&Number.isInteger(value)&&Number(value)>0))};}catch{return emptyProgress();}}
export function record(p:Progress,s:Surgery,id:string):Progress {
 if(s.status==='active'||p.history.some(r=>r.id===id))return p;
 const won=s.status==='won',c=cases.find(c=>c.id===s.caseId)!;
 return {version:1,skill:Math.min(100,p.skill+(won?(c.difficulty==='Expert'?5:c.difficulty==='Challenging'?4:3):1)),completed:p.completed+Number(won),attempts:p.attempts+1,best:won?{...p.best,[c.id]:Math.min(p.best[c.id]??Infinity,s.turns)}:p.best,history:[{id,caseId:c.id,won,turns:s.turns,mistakes:s.mistakes,date:new Date().toISOString()},...p.history].slice(0,100)};
}
export function saveProgress(p:Progress){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(p));return true;}catch{return false;}}
