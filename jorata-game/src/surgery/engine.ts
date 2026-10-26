import { cases, recipe, toolById, type Case, type ToolId } from './data';
export type Surgery = {caseId:string; mode:'practice'|'random'; patientName:string; scanned:boolean; initialPulse:number; initialTemperature:number; status:'active'|'won'|'lost'; step:number; turns:number; mistakes:number; health:number; pulse:number; temperature:number; bleeding:number; mess:number; sleep:number; clean:number; incisions:number; fractures:number; diagnosed:boolean; lab:boolean; repaired:boolean; criticalTurns:number; skill:number; events:string[]; seed:number};
export function start(c:Case,skill=0,seed=Math.floor(Math.random()*0xffffffff)):Surgery {return {caseId:c.id,mode:'practice',patientName:'Rowan',scanned:false,initialPulse:c.pulse,initialTemperature:c.temperature,status:'active',step:0,turns:0,mistakes:0,health:100,pulse:c.pulse,temperature:c.temperature,bleeding:0,mess:0,sleep:0,clean:25,incisions:0,fractures:c.fractures,diagnosed:false,lab:false,repaired:false,criticalTurns:0,skill,events:[`${c.name}: ${c.symptoms}`, 'Select a tool, then apply it to the patient. Time advances only when you apply a tool.'],seed};}
function random(s:Surgery){s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;}
const names=['Arlo','Mira','Juno','Nico','Sage','Rowan','Lumi','Theo','Cleo','Remy','Iris','Finn'];
export function randomSurgery(skill=0,seed=Math.floor(Math.random()*0xffffffff)):Surgery {
 const picker=start(cases[0],skill,seed);const c=cases[Math.floor(random(picker)*cases.length)];
 const s=start(c,skill,picker.seed);s.mode='random';s.patientName=names[Math.floor(random(s)*names.length)];
 s.pulse=Math.max(48,Math.min(92,c.pulse+Math.floor(random(s)*15)-7));
 s.temperature=Math.round((c.temperature+(random(s)-.5)*.8)*10)/10;
 s.initialPulse=s.pulse;s.initialTemperature=s.temperature;
 s.bleeding=random(s)<.35?1:0;s.mess=s.bleeding;s.sleep=random(s)<.25?6:0;
 if(random(s)<.2){s.pulse=52;s.initialPulse=52;}
 s.events=['New patient admitted. Diagnosis: Unknown Condition.',`Visible symptoms: ${c.symptoms.replace(/(?:Critical|Weak) pulse of \d+;?\s*|[Tt]emperature [\d.]+°;?\s*/g,'').trim()||'Unexplained discomfort.'}`, 'Investigate with Ultrasound. A Lab Kit may be needed to identify an infection.'];
 return s;
}
export function sessionRecipe(s:Surgery,c:Case){return recipe(s.mode==='random'?{...c,pulse:s.initialPulse,temperature:s.initialTemperature}:c);}
function planIndex(s:Surgery,c:Case){
 let i=s.step;const steps=sessionRecipe(s,c);
 if(s.mode==='random')while(i>0&&i<steps.length-1){const t=steps[i].tool;
  if((t==='defibrillator'&&s.pulse>40)||(t==='transfusion'&&s.pulse>=60)||(t==='lab'&&s.lab)||(t==='antibiotics'&&s.temperature<39)||(t==='clamp'&&s.bleeding===0)||(t==='sponge'&&s.mess===0))i++;else break;
 }
 return i;
}
export function emergency(s:Surgery):ToolId|undefined {
 if(!s.diagnosed&&s.mode!=='random')return;
 if(s.pulse<=40)return 'defibrillator';
 if(s.pulse<60)return 'transfusion';
 if(s.bleeding>=2||(s.repaired&&s.bleeding>0))return 'clamp';
 if(s.mess>=2)return 'sponge';
 if(s.temperature>=39&&(!s.lab))return 'lab';
 if(s.temperature>=39)return 'antibiotics';
 if(s.incisions>0&&!s.sleep)return 'anesthetic';
}
export function nextTool(s:Surgery,c:Case):ToolId {return emergency(s)??(!s.diagnosed&&s.scanned?'lab':sessionRecipe(s,c)[planIndex(s,c)]?.tool)??'ultrasound';}
export function objective(s:Surgery,c:Case):string {
 const e=emergency(s);if(e)return `${toolById(e).name}: ${e==='defibrillator'?'critical pulse — respond within three tool turns.':e==='transfusion'?'restore the weak pulse.':e==='clamp'?'stop active bleeding.':e==='sponge'?'clear the obscured site.':e==='lab'?'identify the fever.':e==='antibiotics'?'lower the fever below 39°.':'the patient has woken up.'}`;
 if(!s.diagnosed)return s.scanned?'Identify the condition with the Lab Kit.':'Scan to investigate the unknown condition.';
 return sessionRecipe(s,c)[planIndex(s,c)]?.instruction??'Confirm recovery.';
}
export function applyTool(previous:Surgery,c:Case,tool:ToolId,roll?:()=>number):Surgery {
 if(previous.status!=='active')return previous;
 const s:Surgery={...previous,events:[...previous.events]};const rng=()=>roll?roll():random(s);s.turns++;
 s.step=planIndex(s,c);const steps=sessionRecipe(s,c), planned=steps[s.step]?.tool, expected=nextTool(s,c);const messages:string[]=[];
 const log=(m:string)=>messages.push(m);
 const invasive=['scalpel','pins','fix','stitches','splint'].includes(tool);
 const allowed=tool===expected || (tool==='ultrasound'&&!s.scanned) || (tool==='lab'&&s.scanned&&!s.lab) || (tool==='anesthetic'&&c.depth>0) || (tool==='antiseptic'&&s.diagnosed&&c.depth>0) || (tool==='sponge'&&s.mess>0) || (tool==='clamp'&&s.bleeding>0) || (tool==='antibiotics'&&s.lab&&s.temperature>37) || (tool==='transfusion'&&s.pulse>40&&s.pulse<60) || (tool==='defibrillator'&&s.pulse<=40);
 let reason='';
 if(!allowed)reason=`${toolById(tool).name} cannot help now. ${objective(s,c)}`;
 else if(tool==='scalpel'&&(!s.sleep||s.clean<60))reason=!s.sleep?'The patient is awake. Use Anesthetic before cutting.':'The site is dirty. Use Antiseptic before cutting.';
 else if(['pins','fix'].includes(tool)&&c.depth&&(!s.sleep||s.mess>=2||s.bleeding>=2))reason='Stabilize the patient, clear the site, and keep them asleep before repair.';
 else if(tool==='stitches'&&!s.repaired)reason='Repair the cause with Fix It before closing the incisions.';
 let success=false;
 if(reason){s.mistakes++;s.health-=20;s.pulse-=5;log(`Wrong tool. ${reason}`);if(tool==='scalpel'){s.bleeding++;s.mess++;}}
 else if(invasive&&rng()<Math.max(.02,.14-s.skill*.0012)){s.pulse-=4;if(s.incisions){s.bleeding++;s.mess++;}log(`Skill slip: ${toolById(tool).name} did not take effect. Stabilize if needed, then retry. (Skill ${s.skill}/100)`);}
 else {
  success=true;
  switch(tool){
   case 'ultrasound': s.scanned=true;s.diagnosed=s.mode==='practice'||!c.lab||s.lab;log(s.step===steps.length-1?'Final scan confirms recovery.':s.diagnosed?`Diagnosis confirmed: ${c.name}.`:'Ultrasound: an abnormal signal needs a Lab Kit to identify the condition.');break;
   case 'lab':s.lab=true;if(s.scanned){s.diagnosed=true;log(`Lab investigation complete: ${c.name}. Fever treatment is available.`);}else log('Lab result ready. Fever treatment unlocked; Ultrasound is still needed.');break;
   case 'anesthetic':s.sleep=14;log('Patient asleep for 14 tool turns.');break;
   case 'antiseptic':s.clean=100;log('Operation site clean.');break;
   case 'scalpel':s.incisions++;s.bleeding++;s.mess++;s.clean-=10;log(`Incision opened (${s.incisions}/${c.depth}).`);break;
   case 'clamp':s.bleeding=0;log('Bleeding stopped.');break;
   case 'sponge':s.mess=0;log('Operation site visible.');break;
   case 'splint':s.fractures--;log(`Fracture stabilized. ${s.fractures} remaining.`);break;
   case 'pins':log('Internal pin secured.');break;
   case 'antibiotics':s.temperature=Math.max(37,s.temperature-1.5);log(`Temperature reduced to ${s.temperature.toFixed(1)}°.`);break;
   case 'transfusion':s.pulse=78;log('Pulse restored to 78.');break;
   case 'defibrillator':s.pulse=66;s.criticalTurns=0;log('Critical state resolved. Pulse restored to 66.');break;
   case 'fix':s.repaired=true;log('Underlying condition repaired. Close and confirm.');break;
   case 'stitches':s.incisions--;s.bleeding=Math.max(0,s.bleeding-1);log(`Incision closed. ${s.incisions} remaining.`);break;
  }
  if(tool===planned)s.step++;
  // Lab can complete diagnosis before its recipe slot; resume the remaining treatment.
  if(s.mode==='random')s.step=planIndex(s,c);
 }
 if(tool!=='anesthetic'&&s.sleep>0)s.sleep--;
 // Hazard costs are turn-based; reading the guide or leaving the tab never hurts a patient.
 if(s.bleeding>=2&&tool!=='scalpel'){s.pulse-=4;s.health-=4;}
 if(s.temperature>=39&&s.diagnosed&&tool!=='ultrasound'&&tool!=='lab')s.health-=3;
 if(s.pulse<=40){s.criticalTurns++;log(`Critical pulse. Defibrillator required: ${Math.max(0,3-s.criticalTurns)} tool turns remain.`);}else s.criticalTurns=0;
 if(s.step===steps.length && s.incisions===0 && s.fractures===0 && s.repaired && s.pulse>40 && s.temperature<39 && s.bleeding===0 && s.mess<2 && s.diagnosed){s.status='won';log('Surgery successful. Patient recovered.');}
 // Complications only occur after successful invasive actions, never after final confirmation.
 if(s.status==='active'&&success&&invasive&&rng()<(c.difficulty==='Expert'?.18:.09)){
  const complication=c.complications[Math.floor(rng()*c.complications.length)];
  if(complication==='bleeding'&&s.incisions){s.bleeding+=2;s.mess+=2;log('Complication: unexpected bleeding. Clamp, then Sponge.');}
  else if(complication==='fever'){s.temperature=Math.max(39.5,s.temperature+1.5);log('Complication: rising temperature. Check the lab and use Antibiotics.');}
  else if(complication==='wake'&&s.incisions){s.sleep=0;log('Complication: the patient woke up. Reapply Anesthetic.');}
  else if(complication==='weak'){s.pulse=48;log('Complication: weak pulse. Use Transfusion.');}
  else if(complication==='critical'){s.pulse=35;s.criticalTurns=0;log('Complication: critical pulse. Use Defibrillator within three tool turns.');}
 }
 if(s.health<=0||s.pulse<=0||s.criticalTurns>=3){s.status='lost';log('Game Over. The patient could not recover. Review the guidebook and try again.');}
 s.health=Math.max(0,s.health);s.events=[...messages.reverse(),...s.events].slice(0,40);return s;
}
export function patientState(s:Surgery):'healthy'|'pain'|'fear'|'critical'|'death' {return s.status==='lost'?'death':s.status==='won'?'healthy':s.pulse<=40||s.health<=35?'critical':s.bleeding>=2||s.temperature>=39?'pain':!s.sleep?'fear':'healthy';}
