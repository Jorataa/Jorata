import {levels,roofAt,type Level} from './levels';
import {actor,move,type Actor,type Input,type State} from './movement';
import {Chase} from './chase';
import {attackBox,overlap,strikeGuards,type Guard,type Strike} from './combat';
export type Phase='menu'|'playing'|'paused'|'failed'|'complete';
export type EventKind='jump'|'land'|'hit'|'hurt'|'checkpoint'|'danger'|'vault'|'climb'|'slide'|'escape';
export interface GameEvent {kind:EventKind;x:number;y:number}
export class Run {
 level:Level;player:Actor;chase:Chase;guards:Guard[]=[];phase:Phase='menu';health=3;flow=0;maxFlow=0;score=0;elapsed=0;checkpoint=0;checkpointIndex=0;checkpointScore=0;checkpointTime=0;checkpointMaxFlow=0;strike:Strike|null=null;cooldown=0;invulnerable=0;hitStop=0;events:GameEvent[]=[];reason='';previous:Input={jump:false,slide:false,attack:false};collisionTime=0;pausedState:State='running';slideCleared=new Set<number>();airborneX=0;lastDanger=0;
 constructor(public index=0){this.level=levels[index];this.player=actor(130,this.level.roofs[0].y);this.chase=new Chase(actor(-210,this.player.y));this.resetGuards();}
 resetGuards(){this.guards=this.level.guards.filter(g=>g.x>this.checkpoint).map((g,id)=>({...g,id,home:g.x,hp:1,state:'idle',timer:0,cooldown:0,hit:false}));}
 start(){this.phase='playing';}
 emit(kind:EventKind,x=this.player.x,y=this.player.y){this.events.push({kind,x,y});}
 clean(kind:EventKind){this.flow++;this.maxFlow=Math.max(this.maxFlow,this.flow);this.score+=100+Math.min(this.flow,20)*15;if(this.chase.gap(this.player)<430)this.chase.clean();if(kind!=='land'&&kind!=='hit')this.emit(kind);}
 retry(){const x=this.checkpoint||130,y=roofAt(this.level,x)!.y;this.player=actor(x,y);this.chase=new Chase(actor(x-340,roofAt(this.level,Math.max(0,x-340))?.y??y));this.resetGuards();this.health=3;this.flow=0;this.maxFlow=this.checkpointMaxFlow;this.score=this.checkpointScore;this.elapsed=this.checkpointTime;this.strike=null;this.cooldown=0;this.invulnerable=0;this.hitStop=0;this.previous={jump:false,slide:false,attack:false};this.collisionTime=0;this.events=[];this.slideCleared=new Set(this.level.obstacles.filter(o=>o.x+o.w<x).map(o=>o.id));this.lastDanger=0;this.airborneX=x;this.phase='playing';}
 pause(){if(this.phase==='playing'){this.pausedState=this.player.state;this.player.state='paused';this.phase='paused';this.previous={jump:false,slide:false,attack:false};}}
 resume(){if(this.phase==='paused'){this.player.state=this.pausedState;this.phase='playing';}}
 fail(reason:string){this.reason=reason;this.player.state='caught';this.phase='failed';}
 damage(){if(this.invulnerable>0)return;this.health--;this.strike=null;this.flow=0;this.invulnerable=1.25;this.player.state='hurt';this.player.timer=.22;this.player.vx=85;this.emit('hurt');if(this.health<=0)this.fail('The guards stopped your escape.');}
 step(dt:number,input:Input){
  this.events.length=0;if(this.phase!=='playing')return;if(this.hitStop>0){this.hitStop-=dt;return;}
  this.elapsed+=dt;this.events.length=0;this.cooldown=Math.max(0,this.cooldown-dt);this.invulnerable=Math.max(0,this.invulnerable-dt);
  const p=this.player,pressed=input.jump&&!this.previous.jump;
  if(input.attack&&!this.previous.attack&&this.cooldown===0&&p.state!=='hurt'&&p.state!=='sliding'&&p.state!=='rolling'&&!p.traverse){
   const near=this.guards.find(g=>g.hp>0&&g.x>p.x&&g.x-p.x<70);
   this.strike={kind:!p.grounded||(near&&near.x-p.x>42)?'kick':'punch',elapsed:0,hit:new Set()};this.cooldown=.64;p.state='attacking';
  }
  const wasGround=p.grounded,res=move(p,dt,this.level,input,pressed);
  if(res.jumped){this.airborneX=p.x;this.emit('jump');}
  if(res.vaulted)this.emit('vault');if(res.climbed)this.emit('climb');
  if(res.clean){if(p.x-this.airborneX>95||res.rolled||res.climbed||res.vaulted||!wasGround&&p.traverse===null)this.clean('land');if(res.landed)this.emit('land');}
  if(res.collision){this.collisionTime+=dt;if(this.collisionTime> .15){this.damage();this.collisionTime=0;}}else this.collisionTime=0;
  for(const o of this.level.obstacles)if(o.kind==='slide'&&p.x>o.x+o.w+12&&!this.slideCleared.has(o.id)){this.slideCleared.add(o.id);if(p.state==='sliding'&&Math.abs(p.y-o.y)<5)this.clean('slide');}
  if(this.strike){this.strike.elapsed+=dt;strikeGuards(this.strike,p,this.guards,g=>{this.clean('hit');this.emit('hit',g.x,g.y-50);this.hitStop=.035;});if(this.strike.elapsed>=.5){if(!this.strike.hit.size){this.flow=0;this.chase.slow=0;}this.strike=null;if(p.state==='attacking')p.state=p.grounded?'running':'falling';}}
  for(const g of this.guards){g.cooldown=Math.max(0,g.cooldown-dt);if(g.hp===0){g.timer+=dt;if(g.timer<.3)g.x+=150*dt;continue;}
   if(g.state==='idle'&&g.cooldown===0&&g.x-p.x<150&&g.x-p.x>-60&&Math.abs(g.y-p.y)<100){g.state='attack';g.timer=0;g.hit=false;}
   if(g.state==='attack'){g.timer+=dt;
    // A readable lead-in precedes the pack's two active frames.
    const box=attackBox('punch',g.timer-.48,g.x,g.y,true);
    const h=p.state==='sliding'?34:76;
    if(box&&!g.hit&&overlap(box,{x:p.x-10,y:p.y-h,w:20,h})){g.hit=true;this.damage();}
    if(g.timer>1){g.state='idle';g.cooldown=.55;}
   }
   if(Math.abs(p.x-g.x)<23&&Math.abs(p.y-g.y)<55){p.x=g.x-23;p.vx=Math.min(p.vx,30);}
  }
  this.chase.step(dt,this.level,p,this.elapsed);
  if(this.chase.danger&&this.elapsed-this.lastDanger>1){this.lastDanger=this.elapsed;this.emit('danger');}
  if(this.chase.captured(p))this.fail('The pursuer caught up. Keep your flow.');
  if(p.y>850)this.fail('You missed the rooftop. Try that jump again.');
  const cp=this.level.checkpoints[this.checkpointIndex];if(cp&&p.x>=cp&&p.grounded){this.checkpoint=cp;this.checkpointIndex++;this.health=3;this.checkpointScore=this.score;this.checkpointTime=this.elapsed;this.checkpointMaxFlow=this.maxFlow;this.emit('checkpoint');}
  if(p.x>=this.level.end&&this.phase==='playing'){this.score+=Math.round(this.level.end/10)+Math.max(0,Math.round(900-this.elapsed*5))+this.health*250;this.phase='complete';this.emit('escape');}
  this.previous={...input};
 }
}
