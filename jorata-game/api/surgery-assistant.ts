import type {IncomingMessage,ServerResponse} from 'node:http';
import {cases,tools} from '../src/surgery/data';
import {assistantRules} from '../src/surgery/assistantContext';
const recent=new Map<string,{count:number;until:number}>();
const text=(v:unknown,max=800)=>typeof v==='string'?v.slice(0,max):'';
export async function answer(body:unknown,env:NodeJS.ProcessEnv=process.env,request:typeof fetch=fetch){
 const b=body as Record<string,unknown>;
 if(!b||typeof b.question!=='string'||!b.question.trim()||b.question.length>800||!b.context||typeof b.context!=='object')return {status:400,body:{error:'Ask a question about the current surgery.'}};
 const input=b.context as Record<string,unknown>,revealed=input.revealed===true&&cases.some(c=>c.name===input.diagnosis);
 const scrub=(v:unknown,max=800)=>{let out=text(v,max);if(!revealed)for(const c of cases)out=out.replace(new RegExp(c.name,'gi'),'[unconfirmed condition]');return out;};
 const snapshot:Record<string,unknown>={revealed,diagnosis:revealed?input.diagnosis:'Unknown Condition'};
 for(const key of ['pulse','temperature','condition','bleeding','sleepTurns','cleanliness','incisions','fractures'])if(typeof input[key]==='number'&&Number.isFinite(input[key]))snapshot[key]=Math.max(0,Math.min(1000,input[key] as number));
 for(const key of ['status','consciousness','visibility','objective'])snapshot[key]=scrub(input[key],220);
 for(const key of ['scanned','lab'])snapshot[key]=input[key]===true;
 snapshot.selectedTool=tools.some(t=>t.id===input.selectedTool)?input.selectedTool:null;
 snapshot.actions=Array.isArray(input.actions)?input.actions.slice(0,6).map(v=>scrub(v,250)):[];
 const history=Array.isArray(b.history)?b.history.slice(-6).filter(v=>v&&['user','model'].includes(v.role)).map(v=>({role:v.role,parts:[{text:scrub(v.text,1000)}]})):[];
 const key=env.GEMINI_API_KEY||env.GOOGLE_API_KEY;
 if(!key)return {status:503,body:{error:'The AI companion is unavailable: Gemini is not configured on the server. You can keep playing and use the Guidebook.'}};
 const model=env.GEMINI_MODEL||'gemini-flash-latest';
 if(!/^[a-zA-Z0-9._-]+$/.test(model))return {status:503,body:{error:'The AI model configuration needs attention. You can keep playing.'}};
 try{
  const response=await request(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(20000),body:JSON.stringify({systemInstruction:{parts:[{text:assistantRules}]},contents:[...history,{role:'user',parts:[{text:JSON.stringify({visiblePatient:snapshot,question:scrub(b.question)})}]}],generationConfig:{maxOutputTokens:450,temperature:.25}})});
  if(!response.ok)return {status:response.status===429?429:502,body:{error:response.status===429?'Gemini is busy. Try again shortly; your surgery can continue.':'Gemini could not answer. Try again or use the Guidebook.'}};
  const result=await response.json();const reply=result.candidates?.[0]?.content?.parts?.filter((p:{thought?:boolean})=>!p.thought).map((p:{text?:string})=>p.text??'').join('').trim();
  if(!reply)return {status:502,body:{error:'Gemini returned no answer. Try again or use the Guidebook.'}};
  if(!revealed&&cases.some(c=>reply.toLowerCase().includes(c.name.toLowerCase())))return {status:502,body:{error:'That answer went beyond the available findings. Ask about a visible status or diagnostic tool.'}};
  return {status:200,body:{reply:reply.slice(0,2400)}};
 }catch{return {status:502,body:{error:'Gemini is temporarily unreachable. Your surgery is unaffected; try again or open the Guidebook.'}};}
}
export default async function handler(req:IncomingMessage&{body?:unknown},res:ServerResponse){
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 const send=(status:number,body:unknown)=>{res.statusCode=status;res.end(JSON.stringify(body));};
 if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'Use POST.'});}
 const origin=req.headers.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return send(403,{error:'Origin not allowed.'});}catch{return send(403,{error:'Origin not allowed.'});}}
 if(!req.headers['content-type']?.includes('application/json'))return send(415,{error:'Use JSON.'});
 const now=Date.now(),ip=req.socket.remoteAddress??'unknown';
 for(const [k,v]of recent)if(v.until<now)recent.delete(k);
 const quota=recent.get(ip)??{count:0,until:now+60000};if(quota.count>=12)return send(429,{error:'Give the companion a moment. Try again in a minute.'});quota.count++;recent.set(ip,quota);
 try{
  let body=req.body;
  if(!body){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>12000)return send(413,{error:'Question is too long.'});}body=JSON.parse(data);}
  if(typeof body==='string')body=JSON.parse(body);
  if(JSON.stringify(body).length>12000)return send(413,{error:'Question is too long.'});
  const result=await answer(body);send(result.status,result.body);
 }catch{send(400,{error:'Invalid request.'});}
}
