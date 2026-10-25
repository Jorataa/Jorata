import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cases} from './data';
import {randomSurgery,applyTool,nextTool} from './engine';
import {assistantContext} from './assistantContext';
import {answer} from '../../api/surgery-assistant';
test('generated admissions are hidden, reproducible and completable at zero skill',()=>{
 const seen=new Set<string>();
 for(let seed=0;seed<3000;seed++){
  let s=randomSurgery(0,seed);assert.deepEqual(s,randomSurgery(0,seed));seen.add(s.caseId);
  const c=cases.find(c=>c.id===s.caseId)!;
  assert.equal(s.diagnosed,false);assert.ok(!JSON.stringify(s.events).includes(c.name));
  const context=JSON.stringify(assistantContext(s,null));assert.ok(!context.includes(c.id));assert.ok(!context.includes(c.name));assert.ok(!context.includes('seed'));
  for(let t=0;t<200&&s.status==='active';t++)s=applyTool(s,c,nextTool(s,c));
  assert.equal(s.status,'won',`${seed} ${c.name}: ${JSON.stringify(s)}`);
 }
 assert.equal(seen.size,cases.length);
});
test('hidden infection diagnosis requires both investigations, in either order',()=>{
 let s:ReturnType<typeof randomSurgery>|undefined;for(let seed=0;seed<10000;seed++){s=randomSurgery(100,seed);if(cases.find(c=>c.id===s!.caseId)!.lab)break;}
 assert.ok(s);const c=cases.find(c=>c.id===s!.caseId)!;s={...s,pulse:78,temperature:37};
 const scanned=applyTool(s,c,'ultrasound',()=>.99);assert.equal(scanned.diagnosed,false);assert.equal(applyTool(scanned,c,'lab',()=>.99).diagnosed,true);
 const lab=applyTool({...s,temperature:40},c,'lab',()=>.99);assert.equal(lab.diagnosed,false);assert.equal(applyTool(lab,c,'ultrasound',()=>.99).diagnosed,true);
});
test('missing Gemini configuration is an honest unavailable response',async()=>{
 const s=randomSurgery();const r=await answer({question:'Help',context:assistantContext(s,null)},{});assert.equal(r.status,503);assert.ok('error'in r.body);
});
test('Gemini request contains only allowlisted discovered state, and spoiler output is rejected',async()=>{
 const s=randomSurgery();const context={...assistantContext(s,null),caseId:s.caseId,seed:s.seed,hiddenDisease:'SECRET'};let payload='';
 const fake:typeof fetch=async(_url,options)=>{payload=String(options?.body);return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Use Ultrasound to investigate.'}]}}]}));};
 const r=await answer({question:'What next?',context},{GEMINI_API_KEY:'test-server-only'},fake);assert.equal(r.status,200);assert.ok(!payload.includes('SECRET'));assert.ok(!payload.includes(s.caseId));assert.ok(!payload.includes('test-server-only'));
 const spoiler:typeof fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'It is Broken Arm.'}]}}]}));
 assert.equal((await answer({question:'Guess',context},{GEMINI_API_KEY:'test'},spoiler)).status,502);
});
