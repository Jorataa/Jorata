import metadata from './metadata.json';
import type {Actor} from './movement';
export interface Guard {id:number;x:number;y:number;home:number;hp:number;state:'idle'|'attack'|'knockout';timer:number;cooldown:number;hit:boolean;}
export interface Strike {kind:'punch'|'kick';elapsed:number;hit:Set<number>}
export function attackBox(kind:string,elapsed:number,x:number,y:number,left=false){
 const animation=metadata.animations.find(a=>a.name==='runner'&&a.animation===kind)!;
 const frame=Math.floor(elapsed*animation.fps),attack=animation.attack;
 if(!attack||!attack.active_frames.includes(frame))return null;
 const box=(attack.hitboxes as Record<string,{x:number;y:number;width:number;height:number}>)[String(frame)];
 return {x:x+(left?-box.x-box.width:box.x),y:y+box.y,w:box.width,h:box.height};
}
export const overlap=(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number})=>a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;
export function strikeGuards(strike:Strike,p:Actor,guards:Guard[],onHit:(g:Guard)=>void){
 const box=attackBox(strike.kind,strike.elapsed,p.x,p.y);if(!box)return;
 for(const g of guards)if(g.hp>0&&!strike.hit.has(g.id)&&overlap(box,{x:g.x-12,y:g.y-76,w:24,h:76})){strike.hit.add(g.id);g.hp--;g.state='knockout';g.timer=0;onHit(g);}
}
