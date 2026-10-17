import { useState, type FormEvent } from 'react';
import type { Profile, Task } from './types';
type Mutate=(action:string,payload?:Record<string,unknown>)=>Promise<unknown>;
export function TaskBoard({tasks,members,userId,admin,mutate,fail}:{tasks:Task[];members:Profile[];userId:string;admin:boolean;mutate:Mutate;fail:(message:string)=>void}) {
  const [editing,setEditing]=useState<Task|null>(null),[title,setTitle]=useState(''),[details,setDetails]=useState(''),[assignee,setAssignee]=useState(''),[due,setDue]=useState(''),[busy,setBusy]=useState(false);
  function reset(){setEditing(null);setTitle('');setDetails('');setAssignee('');setDue('');}
  async function save(e:FormEvent){e.preventDefault();setBusy(true);try{await mutate('task_save',{id:editing?.id,title,details,assignee_id:assignee,due_date:due,completed:editing?.completed||false});reset();}catch(e){fail((e as Error).message);}finally{setBusy(false);}}
  function edit(task:Task){setEditing(task);setTitle(task.title);setDetails(task.details);setAssignee(task.assignee_id||'');setDue(task.due_date||'');}
  return <section className="social-tasks" aria-label="Shared tasks"><h3>Shared tasks</h3><p className="social-muted">Everyone in this conversation can contribute.</p>
    {tasks.map(task=><article key={task.id} className={`social-task ${task.completed?'is-complete':''}`} data-task-id={task.id}>
      <label className="social-task-check"><input type="checkbox" aria-label={`Complete ${task.title}`} checked={task.completed} onChange={()=>{void mutate('task_save',{...task,completed:!task.completed}).catch(e=>fail(e.message));}}/><strong>{task.title}</strong></label>
      {task.details&&<p>{task.details}</p>}<p className="social-muted">{members.find(p=>p.id===task.assignee_id)?.display_name||'Unassigned'}{task.due_date?` · Due ${task.due_date}`:''}</p>
      <div className="social-actions"><button onClick={()=>edit(task)}>Edit task</button>{!task.assignee_id&&<button onClick={()=>void mutate('task_save',{...task,assignee_id:userId}).catch(e=>fail(e.message))}>Assign to me</button>}{(admin||task.creator_id===userId)&&<button onClick={()=>void mutate('task_delete',{id:task.id}).catch(e=>fail(e.message))}>Delete task</button>}</div>
    </article>)}
    <form onSubmit={save} className="social-task-form"><h4>{editing?'Edit task':'New task'}</h4><label>Task title<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Details<textarea maxLength={2000} value={details} onChange={e=>setDetails(e.target.value)}/></label><label>Assign to<select aria-label="Assign to" value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">Unassigned</option>{members.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label><label>Deadline<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label><div className="social-actions"><button className="social-primary" disabled={busy}>{editing?'Save task':'Add task'}</button>{editing&&<button type="button" onClick={reset}>Cancel edit</button>}</div></form>
  </section>;
}
