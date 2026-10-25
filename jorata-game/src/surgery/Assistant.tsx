import {useEffect,useRef,useState} from 'react';
import type {Surgery} from './engine';
import type {ToolId} from './data';
import {assistantContext} from './assistantContext';
type Message={role:'user'|'model';text:string};
const poses={idle:'diam',thinking:'berpikir',explaining:'menjelaskan',waiting:'menunggu'};
const quick=['What should I do next?','Explain this tool','Why is the patient unstable?','Help me understand the diagnosis'];
export default function Assistant({session,tool,onGuide}:{session:Surgery;tool:ToolId|null;onGuide:()=>void}){
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[explaining,setExplaining]=useState(false);
 const input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null),log=useRef<HTMLDivElement>(null),pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>pending.current?.abort(),[]);
 useEffect(()=>{if(open)input.current?.focus();},[open]);
 useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight,behavior:'instant'});},[messages,busy,error]);
 useEffect(()=>{if(!explaining)return;const timer=setTimeout(()=>setExplaining(false),7000);return()=>clearTimeout(timer);},[explaining]);
 const state=busy?'thinking':open?(explaining?'explaining':'waiting'):'idle';
 const close=()=>{setOpen(false);trigger.current?.focus();};
 const ask=async(value:string)=>{
  const q=value.trim();if(!q||busy||pending.current)return;
  const controller=new AbortController();pending.current=controller;setBusy(true);setError('');setExplaining(false);setQuestion('');
  setMessages(prev=>[...prev,{role:'user',text:q}]);
  try{
   const response=await fetch('/api/surgery-assistant',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({question:q,context:assistantContext(session,tool),history:messages.slice(-6)})});
   if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('The AI service is unavailable here. You can keep playing or use the Guidebook.');
   const data=await response.json();if(!response.ok||!data.reply)throw new Error(data.error||'Gemini could not answer. Try again.');
   setMessages(prev=>[...prev,{role:'model',text:data.reply}]);setExplaining(true);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to reach Gemini. Try again.');}
  finally{pending.current=null;setBusy(false);}
 };
 return <aside className="s-assistant" data-state={state} aria-label="AI surgery companion">
 {open&&<section className="s-assistant-panel" aria-label="Robot assistant chat" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
 <header><div><strong>Jorata companion</strong><small>{busy?'Thinking with Gemini…':'In-game help · powered by Gemini'}</small></div><button aria-label="Minimize assistant" onClick={close}>−</button></header>
 <div className="s-assistant-log" ref={log} role="log" aria-live="polite" aria-busy={busy}>
 {!messages.length&&<p>I can help you read the monitor, understand a tool, or choose your next move. What shall we look at?</p>}
 {messages.map((m,i)=><p key={i} className={m.role==='user'?'s-user-message':'s-robot-message'}><strong>{m.role==='user'?'You':'Companion'}</strong>{m.text}</p>)}
 {busy&&<p role="status">Checking the visible patient findings…</p>}{error&&<p className="s-assistant-error" role="alert">{error}</p>}
 </div>
 <div className="s-assistant-quick">{quick.map(q=><button key={q} disabled={busy} onClick={()=>void ask(q)}>{q}</button>)}</div>
 <form onSubmit={e=>{e.preventDefault();void ask(question);}}><label className="s-assistant-input">Ask the companion<input ref={input} value={question} onChange={e=>{setQuestion(e.target.value);setExplaining(false);}} maxLength={800} placeholder="Ask about this surgery…" autoComplete="off"/></label><button disabled={busy||!question.trim()} type="submit">Send</button></form>
 <footer><span>Hints use discovered findings only.</span><button onClick={onGuide}>Guidebook ↗</button></footer>
 </section>}
 <button ref={trigger} className="s-robot-trigger" aria-label={open?'Minimize AI assistant':'Open AI assistant'} aria-expanded={open} onClick={()=>open?close():setOpen(true)}><img src={`/surgery/assistant/${poses[state]}.png`} alt="" width="72" height="72"/><span>{busy?'Thinking…':'AI help'}</span></button>
 </aside>;
}
