import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { AiResult } from "../shared/ai-contracts.ts";

// Actual Postgres SQL/RLS, with minimal fixtures for Supabase-owned schemas.
// This verifies application migrations, not hosted Auth/Storage/Realtime transport.
const bootstrap = `
 create role anon nologin; create role authenticated nologin;
 create schema auth; create schema storage; create schema realtime; create schema extensions;
 grant usage on schema auth,storage,realtime,extensions to authenticated,anon;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb,is_anonymous boolean default false,banned_until timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;
 create table realtime.messages(id bigint,topic text);
 alter table realtime.messages enable row level security;
 create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
 -- Postgres' built-in SHA-256 supplies the pgcrypto digest signature used by our migrations.
 create function extensions.digest(text,text) returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;
 create publication supabase_realtime;
`;
const testSecret = "a".repeat(64); // Synthetic local fixture; never used by an application deployment.
type User = { id: string; session: string };

test("Postgres migrations enforce multi-user and AI security boundaries", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const name of (await readdir(directory)).filter(n => n.endsWith(".sql")).sort()) {
      await db.exec(await readFile(new URL(name, directory), "utf8"));
    }
    await db.query("insert into private.jr_backend_keys values('ai',encode(extensions.digest($1,'sha256'),'hex'))", [testSecret]);
    async function user(): Promise<User> {
      const id = randomUUID(), session = randomUUID();
      await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)", [id, JSON.stringify({ username: "qa_" + id.replaceAll("-", "").slice(0,16), display_name: "QA Reader" })]);
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [session,id]);
      return {id,session};
    }
    async function as<T>(who: User, run: (tx: Transaction) => Promise<T>, backend = false): Promise<T> {
      return db.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({sub:who.id,session_id:who.session})]);
        await tx.query("select set_config('request.headers',$1,true)", [JSON.stringify(backend ? {"x-jorata-backend":testSecret} : {})]);
        await tx.exec("set local role authenticated");
        return run(tx);
      });
    }
    async function rpc(who: User, action: string, payload: Record<string,unknown> = {}, ai = false) {
      return as(who, async tx => (await tx.query<{result: any}>(
        `select public.${ai ? "jr_ai_backend" : "jr_action"}($1,$2::jsonb) as result`, [action,JSON.stringify(payload)],
      )).rows[0].result, ai);
    }
    async function group(owner: User, member?: User) {
      const room = (await rpc(owner,"create_group",{name:"QA project"})).id as string;
      if(member) await rpc(owner,"add_member",{room_id:room,user_id:member.id});
      return room;
    }
    const denied = (p: Promise<unknown>) => assert.rejects(p);
    async function begin(who: User, room: string, extra: Record<string,unknown> = {}) {
      const request = {mode:"mention",room_id:room,request_id:randomUUID(),prompt:"@Jorata help plan",consent:true,...extra};
      const admission = await rpc(who,"begin",request,true);
      return {request,admission};
    }
    async function finish(who: User, id: string, result: AiResult = {text:"A synthetic QA answer"}) {
      return rpc(who,"finish",{request_id:id,result,model:"test-only",input_tokens:10,output_tokens:10},true);
    }

    await t.test("outsiders cannot read/write rooms, messages, tasks or media", async () => {
      const a = await user(), b = await user(), c = await user(), room = await group(a,b);
      await rpc(a,"send_message",{room_id:room,body:"Private canary"});
      await rpc(a,"task_save",{room_id:room,title:"Private task"});
      for(const table of ["jr_rooms","jr_messages","jr_tasks","jr_room_members"]) {
        const rows = await as(c,tx => tx.query(`select * from public.${table}`));
        assert.deepEqual(rows.rows,[]);
      }
      await denied(rpc(c,"send_message",{room_id:room,body:"Intrusion"}));
      await denied(rpc(c,"task_save",{room_id:room,title:"Intrusion"}));
      await denied(as(b,tx=>tx.query("insert into public.jr_messages(room_id,sender_id,body) values($1,$2,'Forged')",[room,a.id])));
      const path = `${room}/${a.id}/qa.png`;
      await as(a,tx=>tx.query("insert into storage.objects(bucket_id,name) values('jr-media',$1)",[path]));
      assert.equal((await as(b,tx=>tx.query("select * from storage.objects where name=$1",[path]))).rows.length,1);
      assert.deepEqual((await as(c,tx=>tx.query("select * from storage.objects where name=$1",[path]))).rows,[]);
      await denied(as(c,tx=>tx.query("insert into storage.objects(bucket_id,name) values('jr-media',$1)",[`${room}/${c.id}/forged.png`])));
    });

    await t.test("AI requires admin opt-in, room-scoped context and a server credential", async () => {
      const a = await user(), b = await user(), c = await user(), room = await group(a,b), other = await group(c);
      const secret = (await rpc(c,"send_message",{room_id:other,body:"Cross-group canary"})).id;
      await denied(begin(a,room));
      await denied(rpc(b,"settings",{room_id:room,enabled:true},true));
      await rpc(a,"settings",{room_id:room,enabled:true},true);
      await denied(begin(a,room,{message_ids:[secret]}));
      await denied(as(a,tx=>tx.query("select public.jr_ai_backend('open','{}')")));
      await denied(begin(a,room,{consent:false}));
      const {admission} = await begin(a,room);
      assert(!JSON.stringify(admission.context).includes("Cross-group canary"));
    });

    await t.test("bot attribution persists and no member can impersonate its sender by editing/deleting", async () => {
      const a = await user(), b = await user(), room = await group(a,b);
      await rpc(a,"settings",{room_id:room,enabled:true},true);
      const {request} = await begin(a,room);
      const saved = await finish(a,request.request_id);
      for(const actor of [a,b]) for(const action of ["edit_message","delete_message"])
        await denied(rpc(actor,action,{room_id:room,message_id:saved.message_id,body:"Forged answer"}));
      const rows = (await as(b,tx=>tx.query<{sender_id:string|null;bot_id:string;ai_requested_by:string;body:string}>("select * from public.jr_messages where id=$1",[saved.message_id]))).rows;
      assert.equal(rows[0].sender_id,null);
      assert.equal(rows[0].bot_id,"jorata-ai");
      assert.equal(rows[0].ai_requested_by,a.id);
      assert.equal(rows[0].body,"A synthetic QA answer");
      const own = (await rpc(a,"send_message",{room_id:room,body:"Original"})).id;
      await rpc(a,"edit_message",{room_id:room,message_id:own,body:"Corrected"});
      await denied(rpc(b,"edit_message",{room_id:room,message_id:own,body:"Forged"}));
      await rpc(a,"delete_message",{room_id:room,message_id:own});
    });

    await t.test("cached replies are denied after invocation edits/deletion or answer removal", async () => {
      const a = await user(), room = await group(a);
      await rpc(a,"settings",{room_id:room,enabled:true},true);
      for(const change of ["edit","delete","answer"]) {
        const prompt = `@Jorata help ${change}`;
        const source = (await rpc(a,"send_message",{room_id:room,body:prompt})).id;
        const {request} = await begin(a,room,{prompt,source_message_id:source});
        const saved = await finish(a,request.request_id);
        assert.equal((await rpc(a,"begin",request,true)).cached,true);
        if(change === "answer") await db.query("update public.jr_messages set deleted=true,body='' where id=$1",[saved.message_id]);
        else await rpc(a,change === "edit" ? "edit_message" : "delete_message",{room_id:room,message_id:source,body:"Changed"});
        await denied(rpc(a,"begin",request,true));
      }
    });

    await t.test("context revocation and group disablement invalidate in-flight AI responses", async () => {
      const a = await user(), b = await user(), room = await group(a,b);
      await rpc(a,"settings",{room_id:room,enabled:true},true);
      const source = (await rpc(a,"send_message",{room_id:room,body:"Relevant message"})).id;
      const first = await begin(b,room,{message_ids:[source]});
      await rpc(a,"edit_message",{room_id:room,message_id:source,body:"Revised message"});
      await denied(finish(b,first.request.request_id));
      await rpc(b,"fail",{request_id:first.request.request_id},true);
      const second = await begin(b,room,{prompt:"@Jorata another request"});
      await rpc(a,"settings",{room_id:room,enabled:false},true);
      await denied(finish(b,second.request.request_id));
      await rpc(a,"settings",{room_id:room,enabled:true},true);
      await rpc(a,"remove_member",{room_id:room,user_id:b.id});
      await denied(finish(b,second.request.request_id));
    });

    await t.test("AI tasks require explicit confirmation, requester identity and valid member assignments", async () => {
      const a = await user(), b = await user(), c = await user(), room = await group(a,b);
      await rpc(a,"settings",{room_id:room,enabled:true},true);
      const {request} = await begin(a,room,{mode:"tasks_suggest"});
      await finish(a,request.request_id,{text:"A proposal",tasks:[{title:"Review",details:"Together"}]});
      assert.deepEqual((await as(a,tx=>tx.query("select * from public.jr_tasks where room_id=$1",[room]))).rows,[]);
      const confirmation = {request_id:request.request_id,confirmation:true,items:[{index:0,assignee_id:b.id}]};
      await denied(rpc(a,"confirm_tasks",{...confirmation,confirmation:false},true));
      await denied(rpc(b,"confirm_tasks",confirmation,true));
      await denied(rpc(a,"confirm_tasks",{...confirmation,items:[{index:0,assignee_id:c.id}]},true));
      const result = await rpc(a,"confirm_tasks",confirmation,true);
      assert.equal(result.task_ids.length,1);
      assert.equal((await rpc(a,"confirm_tasks",confirmation,true)).cached,true);
      assert.equal((await as(a,tx=>tx.query("select * from public.jr_tasks where room_id=$1",[room]))).rows.length,1);
    });

    await t.test("AI concurrency and minute budgets are durable database boundaries", async () => {
      const a = await user(), room = (await rpc(a,"open",{},true)).room_id;
      const first = await begin(a,room,{mode:"chat",prompt:"First"});
      await denied(begin(a,room,{mode:"chat",prompt:"Concurrent"}));
      await rpc(a,"fail",{request_id:first.request.request_id},true);
      for(let i=0;i<5;i++) {
        const job = await begin(a,room,{mode:"chat",prompt:`Request ${i}`});
        await rpc(a,"fail",{request_id:job.request.request_id},true);
      }
      await assert.rejects(begin(a,room,{mode:"chat",prompt:"Over quota"}), (e:any)=>e.code === "JRA01");
    });

    await t.test("logout revokes private reads and mutations even while a JWT remains unexpired", async () => {
      const a = await user(), room = await group(a);
      await rpc(a,"send_message",{room_id:room,body:"Private"});
      await db.query("delete from auth.sessions where id=$1",[a.session]);
      await denied(rpc(a,"send_message",{room_id:room,body:"Stale token"}));
      for(const table of ["jr_profiles","jr_rooms","jr_messages","jr_tasks","jr_room_members","jr_ai_requests","jr_activity","jr_blocks","jr_reports"])
        assert.deepEqual((await as(a,tx=>tx.query(`select * from public.${table}`))).rows,[]);
    });

    await t.test("names are checked at signup and update; reports bind targets without AI review", async () => {
      const a = await user(), b = await user(), room = await group(a,b);
      for(const name of ["administrator","j0rata_ai","f4gg0t"]) {
        await denied(db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)", [randomUUID(),JSON.stringify({username:name,display_name:"QA Reader"})]));
        await denied(rpc(a,"profile_update",{username:name,display_name:"QA Reader"}));
      }
      for(const name of ["scunthorpe_reader","cassie"]) await rpc(a,"profile_update",{username:name,display_name:"QA Reader"});
      const message = (await rpc(a,"send_message",{room_id:room,body:"Synthetic reported content"})).id;
      await denied(rpc(a,"report",{user_id:b.id,message_id:message,reason:"Wrong sender"},true));
      const result = await rpc(b,"report",{user_id:a.id,message_id:message,reason:"Please review"},true);
      assert.deepEqual(result,{submitted:true,review:"human",ai_reviewed:false});
      assert.deepEqual((await as(b,tx=>tx.query("select * from public.jr_ai_requests where user_id=$1",[b.id]))).rows,[]);
    });
  } finally {
    await db.close();
  }
});
