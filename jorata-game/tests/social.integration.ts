import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
const qa=JSON.parse(readFileSync(process.env.QA_ACCOUNTS_FILE||'/tmp/jorata-qa-bootstrap.json','utf8')) as {accounts:{id:string;email:string;username:string;password:string}[]};
const url=process.env.VITE_SUPABASE_URL!,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const clients:SupabaseClient[]=[];
async function call(s:SupabaseClient,action:string,payload:Record<string,unknown>={}) {const result=await s.rpc('jr_action',{action,payload});assert.equal(result.error,null,`${action}: ${result.error?.message}`);return result.data as {id:string;room_id?:string};}
async function expectDenied(s:SupabaseClient,action:string,payload:Record<string,unknown>) {const result=await s.rpc('jr_action',{action,payload});assert.ok(result.error,`${action} should reject unauthorized access`);}
async function wait(check:()=>boolean){const end=Date.now()+10000;while(!check()){assert.ok(Date.now()<end,'Realtime event timed out');await new Promise(r=>setTimeout(r,60));}}
try {
  for(const account of qa.accounts) {const s=createClient(url,key,{auth:{persistSession:false}});const login=await s.auth.signInWithPassword({email:account.email,password:account.password});assert.equal(login.error,null);assert.equal(login.data.user?.id,account.id);clients.push(s);}
  const [a,b,c]=clients;assert.ok(c,'Three distinct QA accounts required');
  const dm=await call(a,'open_dm',{user_id:qa.accounts[1].id});
  const same=await call(b,'open_dm',{user_id:qa.accounts[0].id});assert.equal(dm.id,same.id,'DM is unique for each pair');
  const received:{id:string;body:string}[]=[];
  const subscribed=new Promise<void>((resolve,reject)=>{
    const channel=b.channel('qa-messages').on('postgres_changes',{event:'INSERT',schema:'public',table:'jr_messages',filter:`room_id=eq.${dm.id}`},event=>received.push(event.new as {id:string;body:string}));
    const timer=setTimeout(()=>reject(new Error('Realtime subscription timed out')),10000);
    channel.on('system',{},payload=>{if(payload.status==='ok'&&payload.extension==='postgres_changes'){clearTimeout(timer);resolve();}}).subscribe();
  });
  await subscribed;
  const marker=`Hello ${Date.now()}`;
  const message=await call(a,'send_message',{room_id:dm.id,body:marker});await wait(()=>received.some(m=>m.id===message.id));
  const history=await b.from('jr_messages').select('*').eq('id',message.id).single();assert.equal(history.data?.sender_id,qa.accounts[0].id);assert.equal(history.data?.body,marker);
  await expectDenied(b,'edit_message',{room_id:dm.id,message_id:message.id,body:'forged'});
  await expectDenied(b,'delete_message',{room_id:dm.id,message_id:message.id});
  await call(a,'edit_message',{room_id:dm.id,message_id:message.id,body:marker+' edited'});
  const reply=await call(b,'send_message',{room_id:dm.id,body:'A real reply',reply_to:message.id});
  await call(b,'react',{room_id:dm.id,message_id:message.id,emoji:'👍'});
  const reaction=await a.from('jr_reactions').select('*').eq('message_id',message.id);assert.equal(reaction.data?.[0]?.user_id,qa.accounts[1].id);
  const privateRoom=await call(b,'open_dm',{user_id:qa.accounts[2].id});const secret=await call(b,'send_message',{room_id:privateRoom.id,body:'B and C only'});
  const leaked=await a.from('jr_messages').select('*').eq('id',secret.id);assert.deepEqual(leaked.data,[],'A cannot read B/C messages');
  await expectDenied(a,'send_message',{room_id:privateRoom.id,body:'intrusion'});
  const path=`${privateRoom.id}/${qa.accounts[1].id}/${crypto.randomUUID()}.png`;
  const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPzQAAAAASUVORK5CYII=','base64');
  assert.equal((await b.storage.from('jr-media').upload(path,photo,{contentType:'image/png'})).error,null);
  assert.ok((await b.storage.from('jr-media').createSignedUrl(path,60)).data?.signedUrl);
  assert.ok((await a.storage.from('jr-media').createSignedUrl(path,60)).error,'Outsiders cannot obtain private media');
  await expectDenied(a,'send_message',{room_id:dm.id,body:'stolen attachment',attachment_path:path});
  const publicPhoto=await fetch(`${url}/storage/v1/object/public/jr-media/${path}`);assert.equal(publicPhoto.ok,false,'Private photo has no public URL');
  assert.ok((await b.storage.from('jr-media').upload(`${privateRoom.id}/${qa.accounts[1].id}/bad.svg`,'<svg/>',{contentType:'image/svg+xml'})).error,'Server rejects unsafe image types');
  const forged=await a.from('jr_messages').insert({room_id:privateRoom.id,sender_id:qa.accounts[1].id,body:'forged identity'});assert.ok(forged.error,'Direct writes cannot bypass mutation validation');
  const group=await call(a,'create_group',{name:`QA Group ${Date.now()}`});await call(a,'add_member',{room_id:group.id,user_id:qa.accounts[1].id});
  await call(b,'send_message',{room_id:group.id,body:'Group message'});
  await expectDenied(b,'remove_member',{room_id:group.id,user_id:qa.accounts[0].id});
  const task=await call(a,'task_save',{room_id:group.id,title:'Plan our meetup',assignee_id:qa.accounts[1].id,due_date:'2026-12-01'});
  const taskRead=await b.from('jr_tasks').select('*').eq('id',task.id).single();assert.equal(taskRead.data?.assignee_id,qa.accounts[1].id);
  await call(b,'task_save',{...taskRead.data,room_id:group.id,completed:true});assert.equal((await a.from('jr_tasks').select('completed').eq('id',task.id).single()).data?.completed,true);
  await expectDenied(b,'task_delete',{room_id:group.id,id:task.id});
  const community=await call(a,'create_community',{name:`QA Community ${Date.now()}`});
  await call(b,'join_community',{community_id:community.id});await expectDenied(b,'create_channel',{community_id:community.id,name:'member channel'});
  await call(a,'community_role',{community_id:community.id,user_id:qa.accounts[1].id,role:'admin'});
  const channel=await call(b,'create_channel',{community_id:community.id,name:'project'});await call(a,'send_message',{room_id:channel.id,body:'Channel works'});
  await expectDenied(c,'send_message',{room_id:channel.id,body:'Not a member'});
  await expectDenied(a,'profile_update',{username:'administrator',display_name:'Administrator'});
  await expectDenied(a,'profile_update',{username:'safe_user',display_name:'f4gg0t'});
  await call(a,'block',{user_id:qa.accounts[1].id});await expectDenied(b,'send_message',{room_id:dm.id,body:'Blocked sender'});await call(a,'unblock',{user_id:qa.accounts[1].id});
  await call(a,'delete_message',{room_id:dm.id,message_id:message.id});assert.equal((await b.from('jr_messages').select('deleted').eq('id',message.id).single()).data?.deleted,true);
  // These IDs are non-secret and let the browser test reuse the verified conversation.
  writeFileSync('/tmp/jorata-qa-fixtures.json',JSON.stringify({dm:dm.id,group:group.id,privateRoom:privateRoom.id,privateMessage:secret.id,community:community.id,channel:channel.id,reply:reply.id}));
  console.log('PASS: three actual Auth accounts; unique DM, realtime delivery, history, identity, reply/edit/delete/reactions, group membership, collaborative tasks, community roles/channels, blocked sender and RLS privacy/forgery checks.');
} finally {for(const s of clients){await s.removeAllChannels();await s.auth.signOut();}}
