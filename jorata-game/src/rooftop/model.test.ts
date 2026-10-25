import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Run} from './model';
import {actor,move,routeInput,type Input} from './movement';
import {attackBox,strikeGuards,type Guard,type Strike} from './combat';
import {levels,landingClear,roofAt} from './levels';
const empty:Input={jump:false,slide:false,attack:false},dt=1/120;
function pilot(r:Run){const a=r.player,input=routeInput(a,r.level);input.attack=!!r.guards.find(g=>g.hp>0&&g.x>a.x-20&&g.x-a.x<60&&Math.abs(g.y-a.y)<85)&&r.cooldown===0;return input;}
for(let i=0;i<3;i++)test(`${levels[i].name}: full route, checkpoint retries, physical pursuit and all guards`,()=>{
 const r=new Run(i);r.start();const counts:Record<string,number>={};let n=0,maxGap=0,minGap=10000;
 while(r.phase==='playing'&&n++<120*100){r.step(dt,pilot(r));for(const e of r.events)counts[e.kind]=(counts[e.kind]??0)+1;const gap=r.chase.gap(r.player);maxGap=Math.max(maxGap,gap);minGap=Math.min(minGap,gap);assert.ok(r.chase.actor.y<850,'pursuer stays on route');}
 assert.equal(r.phase,'complete',r.reason);assert.ok(r.elapsed>=60&&r.elapsed<=90);assert.equal(r.checkpointIndex,2);assert.ok(r.guards.every(g=>g.hp===0));assert.equal(counts.hit,r.level.guards.length);assert.ok((counts.slide??0)>=4);assert.ok((counts.vault??0)>=4);assert.ok(maxGap<600);assert.ok(minGap>27);
 if(i>0)assert.ok((counts.climb??0)>=3);
 const score=r.checkpointScore;for(let retry=0;retry<30;retry++){r.retry();assert.equal(r.guards.length,r.level.guards.filter(g=>g.x>r.checkpoint).length);assert.equal(r.player.state,'running');assert.equal(r.health,3);assert.equal(r.score,score);assert.equal(r.strike,null);assert.ok(r.chase.gap(r.player)>=339);}
 const playingAfterRetry=()=>r.phase==='playing';let resumed=0;while(playingAfterRetry()&&resumed++<120*40)r.step(dt,pilot(r));assert.equal(r.phase,'complete','checkpoint run remains completable');
 for(const cp of r.level.checkpoints)assert.ok(landingClear(r.level,cp,roofAt(r.level,cp)!.y));
 console.log(`${r.level.name}: ${Math.round(r.checkpointTime)}s to second checkpoint; gap range ${Math.round(minGap)}–${Math.round(maxGap)}px; actions ${JSON.stringify(counts)}`);
});
test('variable jump, 100ms coyote and 120ms buffer',()=>{
 const l=levels[0],full=actor(130,420),short=actor(130,420);let fullTop=420,shortTop=420;
 for(let i=0;i<80;i++){move(full,dt,l,{...empty,jump:i<22},i===0);move(short,dt,l,{...empty,jump:i<2},i===0);fullTop=Math.min(fullTop,full.y);shortTop=Math.min(shortTop,short.y);}assert.ok(shortTop-fullTop>55);
 const edge=actor(l.roofs[0].x+l.roofs[0].w+12,420);edge.grounded=false;edge.coyote=.08;move(edge,dt,l,{...empty,jump:true},true);assert.ok(edge.vy<0);
 const late=actor(edge.x,420);late.grounded=false;late.coyote=0;move(late,dt,l,{...empty,jump:true},true);assert.ok(late.vy>0);
 const buffered=actor(130,410);buffered.grounded=false;buffered.coyote=0;buffered.vy=200;move(buffered,dt,l,{...empty,jump:true},true);for(let i=0;i<10;i++)move(buffered,dt,l,{...empty,jump:true},false);assert.ok(buffered.vy<0,'buffer triggers on landing');
});
test('slide collider clears the beam and restores standing state safely',()=>{
 const l=levels[0],o=l.obstacles.find(o=>o.kind==='slide')!,a=actor(o.x-100,o.y);a.vx=l.speed;
 for(let i=0;i<140;i++){move(a,dt,l,{...empty,slide:i<40},false);if(a.x>o.x&&a.x<o.x+o.w)assert.equal(a.state,'sliding');}assert.ok(a.x>o.x+o.w);assert.equal(a.state,'running');
 const standing=actor(o.x-30,o.y);standing.vx=l.speed;let blocked=false;for(let i=0;i<60;i++)blocked=move(standing,dt,l,empty,false).collision||blocked;assert.ok(blocked);
});
test('one hit per strike, metadata anticipation/recovery, and aerial kick',()=>{
 const g:Guard={id:1,x:170,y:420,home:170,hp:3,state:'idle',timer:0,cooldown:0,hit:false};const p=actor(130,420);let hits=0;const s:Strike={kind:'punch',elapsed:0,hit:new Set()};assert.equal(attackBox('punch',.05,130,420),null);assert.equal(attackBox('punch',.4,130,420),null);
 for(let i=0;i<60;i++){s.elapsed=i*dt;strikeGuards(s,p,[g],()=>hits++);}assert.equal(hits,1);assert.equal(g.hp,2);
 const r=new Run();r.start();r.player.grounded=false;r.player.y=400;r.step(dt,{...empty,attack:true});assert.equal(r.strike?.kind,'kick');
});
test('capture is spatial; hesitation brings danger before failure',()=>{
 const r=new Run();r.start();r.player.x=1710;r.player.y=420;r.player.vx=0;r.chase.actor=actor(1450,420);r.chase.actor.vx=270;r.invulnerable=999;let warned=false;
 for(let i=0;i<120*8&&r.phase==='playing';i++){r.step(dt,empty);if(r.chase.gap(r.player)<95)warned=true;}assert.ok(warned);assert.equal(r.phase,'failed');assert.match(r.reason,/pursuer/);
});
test('pause freezes movement and checkpoint restart clears transient combat state',()=>{
 const r=new Run();r.start();r.step(dt,empty);r.pause();const x=r.player.x,t=r.elapsed;for(let i=0;i<50;i++)r.step(dt,{jump:true,slide:true,attack:true});assert.equal(r.player.x,x);assert.equal(r.elapsed,t);r.resume();r.retry();assert.equal(r.player.state,'running');assert.equal(r.player.traverse,null);assert.deepEqual(r.previous,empty);
});

test('higher drops roll and a buffered jump interrupts recovery',()=>{const a=actor(130,300);a.grounded=false;a.vy=500;a.drop=300;for(let n=0;n<80&&!a.grounded;n++)move(a,dt,levels[0],empty,false);assert.equal(a.state,'rolling');move(a,dt,levels[0],{...empty,jump:true},true);assert.equal(a.state,'jumping');assert.ok(a.vy<0);});
