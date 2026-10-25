export interface Save {unlocked:number;best:number[];muted:boolean;reduced:boolean}
const key='jorata-rooftop-v1';
export function loadSave():Save{let v:Partial<Save>={};try{v=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{/* Local storage may be unavailable. */}return {unlocked:Math.max(0,Math.min(2,Number(v.unlocked)||0)),best:[0,1,2].map(i=>Math.max(0,Number(v.best?.[i])||0)),muted:!!v.muted,reduced:!!v.reduced};}
export function save(value:Save){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* A run remains playable without persistence. */}}
