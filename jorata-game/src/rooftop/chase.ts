import {move,routeInput,type Actor} from './movement';
import type {Level} from './levels';
export class Chase {
 slow=0; warning=0; previousJump=false;
 constructor(public actor:Actor){}
 step(dt:number,level:Level,player:Actor,elapsed:number){
  this.slow=Math.max(0,this.slow-dt);
  // Opening grace, then a small speed advantage. Clean actions buy real ground.
  const speed=level.speed+(elapsed<9?-8:3+(level.speed-270)*.35)-(this.slow>0?105:0);
  const input=routeInput(this.actor,level);
  move(this.actor,dt,{...level,speed},input,input.jump&&!this.previousJump);this.previousJump=input.jump;
  // If a jump remains held between closely spaced markers, buffer at a grounded takeoff.
  
  this.warning=this.gap(player)<95?this.warning+dt:0;
 }
 gap(player:Actor){return player.x-this.actor.x;}
 get danger(){return this.warning>0;}
 captured(player:Actor){return this.gap(player)<27&&Math.abs(this.actor.y-player.y)<72;}
 clean(){this.slow=Math.min(.75,this.slow+.22);}
}
