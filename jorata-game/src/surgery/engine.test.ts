import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cases,recipe} from './data';
import {applyTool,start,nextTool,patientState} from './engine';
import {emptyProgress,record} from './storage';
test('every disease is recoverable with skill 0 across 100 random seeds',()=>{
 for(const c of cases)for(let seed=0;seed<100;seed++){
  let s=start(c,0,seed);
  for(let turn=0;turn<180&&s.status==='active';turn++)s=applyTool(s,c,nextTool(s,c));
  assert.equal(s.status,'won',`${c.name} seed ${seed}: ${JSON.stringify(s)}`);
  assert.equal(s.incisions,0);assert.equal(s.fractures,0);assert.equal(s.bleeding,0);assert.ok(s.temperature<39);assert.ok(s.pulse>40);
 }
});
test('the shared guide recipe completes every case without complications',()=>{
 for(const c of cases){let s=start(c);for(const step of recipe(c))s=applyTool(s,c,step.tool,()=>.99);assert.equal(s.status,'won',c.name);}
});
test('wrong tools lose a patient and terminal states ignore further tools',()=>{
 const c=cases[0];let s=start(c);for(let i=0;i<6;i++)s=applyTool(s,c,'pins',()=>.99);assert.equal(s.status,'lost');assert.equal(patientState(s),'death');assert.strictEqual(applyTool(s,c,'ultrasound'),s);
});
test('critical pulse can be rescued, or ignored for three turns and lost',()=>{
 const c=cases.find(c=>c.id==='heart-attack')!;let s=start(c);s=applyTool(s,c,'ultrasound',()=>.99);assert.equal(nextTool(s,c),'defibrillator');const rescued=applyTool(s,c,'defibrillator',()=>.99);assert.equal(rescued.pulse,66);assert.equal(rescued.status,'active');
 s=applyTool(s,c,'antiseptic',()=>.99);s=applyTool(s,c,'antiseptic',()=>.99);assert.equal(s.status,'lost');
});
test('skill slips leave the recipe unchanged and recovery actions resume it',()=>{
 const c=cases[0];let s=start(c);s=applyTool(s,c,'ultrasound',()=>.99);const before=s.step;s=applyTool(s,c,'splint',()=>0);assert.equal(s.step,before);assert.equal(s.fractures,1);s=applyTool(s,c,'splint',()=>.99);assert.equal(s.fractures,0);
});
test('wrong cutting hurts, sleep and cleanliness guard the scalpel',()=>{
 const c=cases[1];let s=start(c);s=applyTool(s,c,'scalpel',()=>.99);assert.equal(s.health,80);assert.equal(s.incisions,0);
});
test('all random complication types fire and have a usable response',()=>{
 for(const kind of ['bleeding','fever','weak','wake','critical'] as const){const base=cases[1],c={...base,complications:[kind]};let s=start(c);for(const tool of ['ultrasound','antiseptic','anesthetic'] as const)s=applyTool(s,c,tool,()=>.99);let rolls=[.99,0,0];s=applyTool(s,c,'scalpel',()=>rolls.shift()??.99);assert.ok(s.events.some(e=>e.startsWith('Complication:')),kind);for(let i=0;i<80&&s.status==='active';i++)s=applyTool(s,c,nextTool(s,c),()=>.99);assert.equal(s.status,'won',kind);}
});
test('progress records wins/losses exactly once, with best turn counts and skill cap',()=>{
 const c=cases[0];let s=start(c);for(const t of recipe(c))s=applyTool(s,c,t.tool,()=>.99);let p=record(emptyProgress(),s,'one');assert.equal(p.completed,1);assert.equal(p.skill,3);assert.equal(p.best[c.id],s.turns);assert.strictEqual(record(p,s,'one'),p);p=record({...p,skill:99},s,'two');assert.equal(p.skill,100);const failed={...s,status:'lost' as const};p=record(p,failed,'three');assert.equal(p.attempts,3);assert.equal(p.completed,2);assert.equal(p.history.length,3);
});
