export const tools = [
  { id: 'ultrasound', name: 'Ultrasound', glyph: 'scan', effect: 'Investigates hidden structural conditions and fractures; confirms recovery after treatment. Infection cases also need Lab Kit findings.', limitation: 'Final scan needs every recipe step complete and stable conditions.', example: 'Scan before treating Broken Arm, then scan again to finish.' },
  { id: 'anesthetic', name: 'Anesthetic', glyph: 'syringe', effect: 'Sets sleep to 14 tool turns. Reapply if the patient wakes.', limitation: 'Does not clean the operation site or repair damage.', example: 'Use before a scalpel; use again when consciousness says Awake.' },
  { id: 'antiseptic', name: 'Antiseptic', glyph: 'bottle', effect: 'Restores site cleanliness to 100%.', limitation: 'A scalpel needs at least 60% cleanliness.', example: 'Clean the site before the first incision.' },
  { id: 'scalpel', name: 'Scalpel', glyph: 'blade', effect: 'Opens one incision and reveals deeper treatment access.', limitation: 'Requires diagnosis, sleep, a clean site, and the recipe’s incision depth.', example: 'Lung Tumor needs two incisions before Fix It.' },
  { id: 'stitches', name: 'Stitches', glyph: 'stitch', effect: 'Closes one incision and reduces bleeding by one.', limitation: 'Repair the cause with Fix It before closing.', example: 'Close each incision after the repair.' },
  { id: 'splint', name: 'Splint', glyph: 'splint', effect: 'Stabilizes one fracture in the recipe.', limitation: 'Only works when a fracture is ready to stabilize.', example: 'Broken Arm requires one splint.' },
  { id: 'pins', name: 'Pins', glyph: 'pins', effect: 'Secures an internal fracture or a fictional implant.', limitation: 'Needs the recipe’s open incisions, a clear site, and sleep.', example: 'Secure a Broken Leg before Fix It.' },
  { id: 'clamp', name: 'Surgical Clamp', glyph: 'clamp', effect: 'Stops all active bleeding without closing incisions.', limitation: 'Requires active bleeding.', example: 'Clamp when unexpected bleeding reaches 2.' },
  { id: 'sponge', name: 'Surgical Sponge', glyph: 'sponge', effect: 'Clears all pooled blood so you can see the site.', limitation: 'Does not stop the source of bleeding.', example: 'After a clamp, clear an obscured site with a sponge.' },
  { id: 'antibiotics', name: 'Antibiotics', glyph: 'capsule', effect: 'Lowers temperature by 1.5 game degrees, to a minimum of 37.', limitation: 'Needs a Lab Kit diagnosis for an infection recipe.', example: 'Treat fever again if a complication raises temperature to 39.' },
  { id: 'lab', name: 'Lab Kit', glyph: 'lab', effect: 'Identifies the fictional infection and unlocks its treatment.', limitation: 'Can investigate fever before the scan; combine with Ultrasound to reveal hidden infection diagnoses.', example: 'Run a lab test before treating Bird Flu.' },
  { id: 'transfusion', name: 'Transfusion', glyph: 'bag', effect: 'Restores a weak pulse to 78.', limitation: 'Use for a pulse between 41 and 59. A critical pulse needs the defibrillator.', example: 'Restore the weak pulse in Kidney Failure.' },
  { id: 'defibrillator', name: 'Defibrillator', glyph: 'bolt', effect: 'Restores a critical pulse (40 or less) to 66.', limitation: 'Use within three tool turns of a critical alert.', example: 'Stabilize Heart Attack at admission.' },
  { id: 'fix', name: 'Fix It', glyph: 'fix', effect: 'Repairs the case’s underlying problem.', limitation: 'Complete all preparation, pins, and required incisions first.', example: 'Repair Appendicitis, then stitch and confirm with Ultrasound.' },
] as const;
export type ToolId = typeof tools[number]['id'];
export type Complication = 'bleeding' | 'fever' | 'weak' | 'wake' | 'critical';
export type Case = {id:string; name:string; category:string; difficulty:'Routine'|'Challenging'|'Expert'; description:string; symptoms:string; pulse:number; temperature:number; fractures:number; depth:number; lab:boolean; pins:number; complications:Complication[]; tip:string};
const define = (id:string,name:string,category:string,difficulty:Case['difficulty'],description:string,depth:number,options:Partial<Case>={}):Case => ({id,name,category,difficulty,description,symptoms:'Pain and anxiety; awake at admission.',pulse:78,temperature:37,fractures:0,depth,lab:false,pins:0,complications:['bleeding','wake'],tip:'Follow the next objective, and stabilize complications before continuing.',...options});
export const cases:Case[] = [
 define('broken-arm','Broken Arm','Arms & Hands','Routine','A tumble in Mosslight has left a pixel bone out of place.',1,{fractures:1,symptoms:'Arm pain; one fracture.'}),
 define('torn-muscle','Torn Muscle','Arms & Hands','Routine','An overenthusiastic block punch needs a little repair.',1,{symptoms:'Muscle pain; no fractures.'}),
 define('broken-leg','Broken Leg','Legs & Feet','Challenging','A deep fracture needs both support and an internal pin.',2,{fractures:1,pins:1,symptoms:'Leg pain; one unstable fracture.',complications:['bleeding','weak']}),
 define('chicken-feet','Chicken Feet','Legs & Feet','Routine','A strange transformation has made walking rather feathery.',1,{fractures:2,symptoms:'Two wobbly, feathered feet.'}),
 define('heart-attack','Heart Attack','Heart','Expert','The pixel heart is flickering. Restore its rhythm first.',2,{pulse:35,pins:1,symptoms:'Critical pulse of 35; chest distress.',complications:['critical','bleeding']}),
 define('broken-heart','Broken Heart','Heart','Challenging','A fractured heart crystal needs a fictional repair.',1,{pulse:52,symptoms:'Weak pulse of 52; low spirits.',complications:['weak','wake']}),
 define('brain-tumor','Brain Tumor','Brain & Head','Expert','A troublesome pixel growth needs careful access.',3,{pins:1,symptoms:'Headache; deep growth.',complications:['wake','critical']}),
 define('lung-tumor','Lung Tumor','Lungs & Chest','Challenging','A clouded chest scan hides a stubborn pixel growth.',2,{pulse:55,symptoms:'Weak pulse of 55; chest discomfort.',complications:['bleeding','weak']}),
 define('appendicitis','Appendicitis','Abdomen & Organs','Challenging','A grumbling pixel appendix is running hot.',2,{lab:true,temperature:39.5,symptoms:'Temperature 39.5°; abdominal pain.',complications:['fever','bleeding']}),
 define('kidney-failure','Kidney Failure','Abdomen & Organs','Expert','The world’s tiny filter needs an implant and repair.',2,{lab:true,pins:1,pulse:48,temperature:38.5,symptoms:'Weak pulse of 48; temperature 38.5°.',complications:['weak','fever']}),
 define('bird-flu','Bird Flu','Infections','Routine','A fictional feather-borne bug has caused a fever.',0,{lab:true,temperature:40,symptoms:'Temperature 40°; occasional chirping.',complications:['fever']}),
 define('world-lock','Swallowed World Lock','Special Cases','Challenging','Someone mistook a shiny world lock for a snack.',2,{symptoms:'Abdominal discomfort; suspicious metallic rattle.',complications:['bleeding','wake']}),
 define('broken-everything','Broken Everything','Special Cases','Expert','A spectacular fall left four fractures and deep damage.',3,{fractures:4,pins:2,pulse:50,symptoms:'Four fractures; weak pulse of 50.',complications:['bleeding','critical','wake']}),
 define('chaos-infection','Chaos Infection','Advanced Maladies','Expert','A chaotic pixel bug fights back while you repair its source.',2,{lab:true,temperature:40,pins:1,symptoms:'Temperature 40°; unpredictable instability.',complications:['fever','critical','bleeding'],tip:'A lab test unlocks antibiotics. Recheck the pulse after every invasive tool.'}),
];
export const categories = [...new Set(cases.map(c=>c.category))];
export const toolById = (id:ToolId) => tools.find(t=>t.id===id)!;
export type RecipeStep = {tool:ToolId; instruction:string};
export function recipe(c:Case):RecipeStep[] {
 const steps:RecipeStep[] = []; const add=(tool:ToolId,instruction:string)=>steps.push({tool,instruction});
 add('ultrasound','Scan to reveal the patient’s condition.');
 if(c.pulse<=40)add('defibrillator','Restore the critical pulse.');else if(c.pulse<60)add('transfusion','Restore the weak pulse.');
 if(c.lab)add('lab','Identify the infection with the Lab Kit.');
 for(let t=c.temperature;t>=39;t-=1.5)add('antibiotics','Lower the fever below 39°.');
 for(let i=0;i<c.fractures;i++)add('splint','Stabilize one fracture.');
 if(c.depth){add('antiseptic','Clean the operation site.');add('anesthetic','Put the patient to sleep.');for(let i=0;i<c.depth;i++){add('scalpel',`Open incision ${i+1} of ${c.depth}.`);if(i%2===1||i===c.depth-1){add('clamp','Stop incision bleeding.');add('sponge','Clear pooled blood.');}}for(let i=0;i<c.pins;i++)add('pins','Secure one internal pin.');}
 add('fix','Repair the underlying fictional condition.');
 for(let i=0;i<c.depth;i++)add('stitches','Close one incision.');
 add('ultrasound','Confirm recovery with a final scan.');return steps;
}
