import {landingClear,roofAt,type Level} from './levels';
export type State='running'|'jumping'|'falling'|'sliding'|'vaulting'|'climbing'|'rolling'|'attacking'|'hurt'|'caught'|'paused';
export interface Input { jump:boolean; slide:boolean; attack:boolean }
export interface Actor {x:number;y:number;vx:number;vy:number;state:State;grounded:boolean;coyote:number;buffer:number;held:number;timer:number;drop:number;traverse:null|{x:number;y:number;toX:number;toY:number;duration:number;elapsed:number};}
export const GRAVITY=1500,JUMP=-530,COYOTE=.1,BUFFER=.12;
export function actor(x:number,y:number):Actor{return {x,y,vx:0,vy:0,state:'running',grounded:true,coyote:COYOTE,buffer:0,held:0,timer:0,drop:y,traverse:null};}
export function jump(a:Actor){a.vy=JUMP;a.grounded=false;a.coyote=0;a.buffer=0;a.held=0;a.drop=a.y;a.state='jumping';}
export function traverse(a:Actor,state:'vaulting'|'climbing',x:number,y:number,duration:number){a.traverse={x:a.x,y:a.y,toX:x,toY:y,duration,elapsed:0};a.timer=duration;a.state=state;a.vy=0;a.grounded=false;}
export interface MotionResult {jumped:boolean;landed:boolean;clean:boolean;collision:boolean;rolled:boolean;climbed:boolean;vaulted:boolean}
export function move(a:Actor,dt:number,l:Level,input:Input,pressed:boolean):MotionResult {
 const out:MotionResult={jumped:false,landed:false,clean:false,collision:false,rolled:false,climbed:false,vaulted:false};
 a.timer=Math.max(0,a.timer-dt);a.buffer=Math.max(0,a.buffer-dt);if(pressed)a.buffer=BUFFER;
 if(a.traverse){const t=a.traverse;t.elapsed+=dt;const p=Math.min(1,t.elapsed/t.duration);a.x=t.x+(t.toX-t.x)*p;a.y=t.y+(t.toY-t.y)*p-Math.sin(p*Math.PI)*(a.state==='vaulting'?62:12);if(p===1){a.traverse=null;a.grounded=true;a.state='running';a.vx=l.speed;out.clean=true;}return out;}
 if(a.grounded)a.coyote=COYOTE;else a.coyote=Math.max(0,a.coyote-dt);
 if(a.buffer>0&&(a.grounded||a.coyote>0)&&a.state!=='hurt'){
  const o=l.obstacles.find(o=>o.kind==='vault'&&o.x-a.x>=-15&&o.x-a.x<110&&Math.abs(o.y-a.y)<4);
  if(o&&landingClear(l,o.x+o.w+40,o.y)){traverse(a,'vaulting',o.x+o.w+40,o.y,.44);a.buffer=0;out.vaulted=true;return out;}
  jump(a);out.jumped=true;
 }
 if(input.slide&&a.grounded&&a.state!=='attacking'&&a.state!=='hurt'){if(a.state!=='sliding')a.timer=.38;a.state='sliding';}
 const under=l.obstacles.some(o=>o.kind==='slide'&&a.x+12>o.x&&a.x-12<o.x+o.w&&Math.abs(a.y-o.y)<8);
 if(a.state==='sliding'&&a.timer===0&&!under&&!input.slide)a.state='running';
 if((a.state==='hurt'||a.state==='rolling')&&a.timer===0)a.state=a.grounded?'running':'falling';
 const target=a.state==='hurt'?95:a.state==='attacking'?Math.min(a.vx,110):l.speed;
 a.vx+=Math.max(-900*dt,Math.min(900*dt,target-a.vx));
 const oldX=a.x,oldY=a.y; a.x+=a.vx*dt;
 if(a.vy<0){a.held+=dt;if(!input.jump)a.vy=Math.max(a.vy,-230);}
 a.vy=Math.min(900,a.vy+(input.jump&&a.vy<0&&a.held<.17?850:GRAVITY)*dt);a.y+=a.vy*dt;
 a.grounded=false;
 for(const r of l.roofs){
  if(a.x+10>r.x&&a.x-10<r.x+r.w&&oldY<=r.y+.1&&a.y>=r.y&&a.vy>=0){a.y=r.y;a.vy=0;a.grounded=true;if(oldY<r.y-1){out.landed=true;out.clean=true;if(a.state!=='attacking'&&a.state!=='hurt')a.timer=.12;if(r.y-a.drop>65){a.state='rolling';a.timer=.24;out.rolled=true;}}break;}
 }
 // Marked ledges alone allow a forgiving grab, with validated headroom and landing.
 if(!a.grounded)for(const r of l.roofs){if(r.climb&&oldX+12<=r.x+5&&a.x+12>=r.x&&a.y>r.y&&a.y<r.y+76&&(input.jump||a.buffer>0)&&landingClear(l,r.x+46,r.y)){traverse(a,'climbing',r.x+46,r.y,.46);out.climbed=true;return out;}}
 for(const r of l.roofs){if(a.x+10>r.x&&oldX+10<=r.x+3&&a.y>r.y+3&&a.y-76<r.y+300){a.x=r.x-10;a.vx=0;out.collision=true;}}
 for(const o of l.obstacles){
  const h=a.state==='sliding'||a.state==='rolling'?34:76;
  const top=o.kind==='slide'?o.y-112:o.y-48,bottom=o.kind==='slide'?o.y-68:o.y;
  if(a.x+10>o.x+(o.kind==='vault'?8:0)&&a.x-10<o.x+o.w&&a.y>top&&a.y-h<bottom){
   // Obstacles are solid: a valid landing on top is possible; overhead beams require a slide.
   if(o.kind==='vault'&&oldY<=top&&a.vy>=0){a.y=top;a.vy=0;a.grounded=true;}
   else {a.x=oldX;a.vx=0;out.collision=true;}
  }
 }
 a.drop=Math.min(a.drop,a.y);
 if(a.state!=='sliding'&&a.state!=='rolling'&&a.state!=='hurt'&&a.state!=='attacking')a.state=a.grounded?'running':a.vy<0?'jumping':'falling';
 return out;
}
// Shared route markers drive the pursuer's physical traversal, including roof edges.
export function routeInput(a:Actor,l:Level):Input {
 const roof=roofAt(l,a.x),next=roof&&l.roofs[l.roofs.indexOf(roof)+1];
 const obstacle=l.obstacles.find(o=>o.x+o.w>a.x-15&&o.x-a.x<130&&Math.abs(o.y-a.y)<5);
 const edge=!!next&&!!roof&&roof.x+roof.w-a.x<75;
 return {jump:edge||a.state==='jumping'||a.state==='falling'||a.state==='climbing'||(!!obstacle&&obstacle.kind==='vault'&&obstacle.x-a.x<100),slide:!!obstacle&&obstacle.kind==='slide',attack:false};
}
