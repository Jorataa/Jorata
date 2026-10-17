-- Additive AI/security foundation. No existing messages, accounts or guest data are deleted.
-- Access tokens alone can outlive logout. Bind protected operations to a live Auth session.
create function private.jr_session_active() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
  where s.user_id=(select auth.uid()) and s.id=nullif((select auth.jwt())->>'session_id','')::uuid
   and (s.not_after is null or s.not_after>now()) and not coalesce(u.is_anonymous,false)
   and (u.banned_until is null or u.banned_until<now())),false)
$$;
revoke all on function private.jr_session_active() from public,anon;
grant execute on function private.jr_session_active() to authenticated;
create or replace function private.jr_room_access(rid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.jr_session_active() and exists(select 1 from public.jr_rooms r where r.id=rid and (
  exists(select 1 from public.jr_room_members m where m.room_id=r.id and m.user_id=(select auth.uid()))
  or exists(select 1 from public.jr_community_members m where m.community_id=r.community_id and m.user_id=(select auth.uid()))))
$$;
alter function private.jr_action(text,jsonb) rename to jr_action_core;
revoke all on function private.jr_action_core(text,jsonb) from public,anon,authenticated;
create function private.jr_action(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.jr_session_active() then raise exception using errcode='42501',message='An active account session is required.';end if;
 return private.jr_action_core(action,payload);
end $$;
revoke all on function private.jr_action(text,jsonb) from public,anon;
grant execute on function private.jr_action(text,jsonb) to authenticated;
create or replace function public.jr_action(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.jr_action(action,payload) $$;
alter policy jr_profiles_read on public.jr_profiles using((select private.jr_session_active()));
alter policy jr_communities_read on public.jr_communities using((select private.jr_session_active()));
alter policy jr_world_read on public.jr_world_tiles using((select private.jr_session_active()));

create table private.jr_backend_keys (purpose text primary key, secret_hash text not null check(length(secret_hash)=64));
alter table private.jr_backend_keys enable row level security;
revoke all on private.jr_backend_keys from public,anon,authenticated;

create table public.jr_bots (id text primary key,display_name text not null,provider text not null);
insert into public.jr_bots values('jorata-ai','JORATA AI','Google Gemini');
alter table public.jr_bots enable row level security;
revoke all on public.jr_bots from public,anon,authenticated;
grant select on public.jr_bots to authenticated;
create policy jr_bots_read on public.jr_bots for select to authenticated using(true);

alter table public.jr_rooms drop constraint jr_rooms_kind_check;
alter table public.jr_rooms add constraint jr_rooms_kind_check check(kind in ('direct','group','channel','ai'));
create unique index jr_one_ai_room_per_user on public.jr_rooms(owner_id) where kind='ai';
alter table public.jr_messages alter column sender_id drop not null;
alter table public.jr_messages add column bot_id text references public.jr_bots;
alter table public.jr_messages add constraint jr_message_actor check(num_nonnulls(sender_id,bot_id)=1);
create index jr_messages_sender_time on public.jr_messages(sender_id,created_at desc);

create table public.jr_room_ai_settings (
 room_id uuid primary key references public.jr_rooms on delete cascade,
 enabled boolean not null default false,
 updated_by uuid not null references public.jr_profiles,
 updated_at timestamptz not null default now()
);
alter table public.jr_room_ai_settings enable row level security;
revoke all on public.jr_room_ai_settings from public,anon,authenticated;
grant select on public.jr_room_ai_settings to authenticated;
create policy jr_ai_settings_read on public.jr_room_ai_settings for select to authenticated using(private.jr_room_access(room_id));

create table public.jr_ai_requests (
 id uuid primary key,
 user_id uuid not null references public.jr_profiles,
 room_id uuid references public.jr_rooms on delete cascade,
 mode text not null check(mode in ('chat','mention','summarize','explain','draft','translate','tasks_suggest','username')),
 input_hash text not null,
 context_ids uuid[] not null default '{}',
 task_ids uuid[] not null default '{}',
 context_hash text not null,
 source_message_id uuid references public.jr_messages,
 source_hash text,
 status text not null default 'running' check(status in ('running','done','failed')),
 result jsonb,
 result_message_id uuid references public.jr_messages,
 confirmed_task_ids jsonb,
 error_code text,
 model text,
 input_tokens integer not null default 0 check(input_tokens>=0),
 output_tokens integer not null default 0 check(output_tokens>=0),
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create index jr_ai_user_time on public.jr_ai_requests(user_id,created_at desc);
create index jr_ai_time on public.jr_ai_requests(created_at desc);
create index jr_ai_settings_editor on public.jr_room_ai_settings(updated_by);
create index jr_messages_bot on public.jr_messages(bot_id) where bot_id is not null;
create index jr_ai_room on public.jr_ai_requests(room_id);
create index jr_ai_source on public.jr_ai_requests(source_message_id);
create index jr_ai_output on public.jr_ai_requests(result_message_id);
alter table public.jr_ai_requests enable row level security;
revoke all on public.jr_ai_requests from public,anon,authenticated;
grant select on public.jr_ai_requests to authenticated;
-- Results/drafts/task proposals belong to their requester, and require continuing room access.
create policy jr_ai_requests_read on public.jr_ai_requests for select to authenticated using(user_id=(select auth.uid()) and (room_id is null or private.jr_room_access(room_id)));

create function private.jr_require_backend() returns void language plpgsql security definer set search_path='' as $$
declare secret text := coalesce(current_setting('request.headers',true),'{}')::jsonb->>'x-jorata-backend';
begin
 if not private.jr_session_active() or secret is null or length(secret)<>64 or not exists(select 1 from private.jr_backend_keys where purpose='ai' and secret_hash=encode(extensions.digest(secret,'sha256'),'hex')) then
  raise exception using errcode='42501', message='Backend authorization required.';
 end if;
end $$;

create function private.jr_ai_context(rid uuid,mids uuid[],tids uuid[]) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'sender',case when m.bot_id is not null then 'JORATA AI' else p.display_name end,'body',left(m.body,1200),'edited_at',m.edited_at,'created_at',m.created_at) order by m.created_at,m.id) from public.jr_messages m left join public.jr_profiles p on p.id=m.sender_id where m.room_id=rid and m.id=any(mids) and not m.deleted),'[]'::jsonb),
  'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'details',left(t.details,500),'completed',t.completed,'due_date',t.due_date,'updated_at',t.updated_at) order by t.id) from public.jr_tasks t where t.room_id=rid and t.id=any(tids) and not t.deleted),'[]'::jsonb)
 )
$$;

create function private.jr_ai_backend(operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();rid uuid; reqid uuid; room public.jr_rooms; job public.jr_ai_requests;
 mids uuid[]:='{}';tids uuid[]:='{}';ctx jsonb; fingerprint text; ihash text; mode text; prompt text;
 item jsonb; proposals jsonb; task_result jsonb; created jsonb:='[]';idx integer; result_mid uuid; source_mid uuid;
begin
 perform private.jr_require_backend();
 if jsonb_typeof(payload)<>'object' or octet_length(payload::text)>50000 then raise exception using errcode='JRA03',message='Invalid request.';end if;
 if not exists(select 1 from public.jr_profiles where id=uid) then raise exception using errcode='42501',message='Profile required.';end if;
 if operation='open' then
  perform private.jr_limit('ai_open',10);
  insert into public.jr_rooms(kind,name,owner_id) values('ai','JORATA AI',uid)
   on conflict(owner_id) where kind='ai' do update set name='JORATA AI' returning id into rid;
  insert into public.jr_room_members values(rid,uid,'owner') on conflict do nothing;
  return jsonb_build_object('room_id',rid,'bot_id','jorata-ai');
 end if;
 if operation='settings' then
  rid:=(payload->>'room_id')::uuid;
  select * into room from public.jr_rooms where id=rid;
  if room.kind not in ('group','channel') or not private.jr_room_admin(rid) then raise exception using errcode='42501',message='Group admin required.';end if;
  perform private.jr_limit('ai_settings',10);
  insert into public.jr_room_ai_settings values(rid,(payload->>'enabled')::boolean,uid,now()) on conflict(room_id) do update set enabled=excluded.enabled,updated_by=uid,updated_at=now();
  return jsonb_build_object('room_id',rid,'enabled',(payload->>'enabled')::boolean);
 end if;
 if operation='report' then
  perform private.jr_action('report',payload);
  return jsonb_build_object('submitted',true,'review','human','ai_reviewed',false);
 end if;
 if operation='moderation_check' then
  perform private.jr_limit('name_checks',12);
  return '{}'::jsonb;
 end if;
 if operation='begin' then
  reqid:=(payload->>'request_id')::uuid;mode:=payload->>'mode';rid:=nullif(payload->>'room_id','')::uuid;
  if mode not in ('chat','mention','summarize','explain','draft','translate','tasks_suggest','username') or (payload->>'consent')::boolean is distinct from true then raise exception using errcode='JRA03',message='Explicit consent required.';end if;
  if mode<>'username' then
   if not private.jr_room_access(rid) then raise exception using errcode='42501',message='Conversation unavailable.';end if;
   select * into room from public.jr_rooms where id=rid;
   if mode='chat' and (room.kind<>'ai' or room.owner_id<>uid) then raise exception using errcode='42501',message='Use your own AI conversation.';end if;
   if mode='mention' and (room.kind not in ('group','channel') or not exists(select 1 from public.jr_room_ai_settings where room_id=rid and enabled)) then raise exception using errcode='JRA03',message='Group AI is disabled.';end if;
   -- All group AI, including contextual summaries, is opt-in at group level.
   if room.kind in ('group','channel') and not exists(select 1 from public.jr_room_ai_settings where room_id=rid and enabled) then raise exception using errcode='JRA03',message='Group AI is disabled.';end if;
  elsif rid is not null then raise exception using errcode='JRA03',message='Name reviews cannot include conversation context.';
  end if;
  ihash:=encode(extensions.digest((payload-'request_id')::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('jorata-ai-budget',0));
  select * into job from public.jr_ai_requests where id=reqid for update;
  if found then
   if job.user_id<>uid or job.input_hash<>ihash then raise exception using errcode='42501',message='Request unavailable.';end if;
   if job.status='done' then
    -- Do not replay a cached answer after source messages/tasks were edited or removed.
    ctx:=private.jr_ai_context(job.room_id,job.context_ids,job.task_ids);
    if encode(extensions.digest(ctx::text,'sha256'),'hex')<>job.context_hash then raise exception using errcode='JRA02',message='Context changed.';end if;
    return jsonb_build_object('cached',true,'result',job.result,'room_id',job.room_id,'message_id',job.result_message_id);
   end if;
   raise exception using errcode='JRA02',message='Request is running or failed. Use a new request after checking history.';
  end if;
  if exists(select 1 from public.jr_ai_requests where user_id=uid and input_hash=ihash and created_at>now()-interval '30 seconds') then raise exception using errcode='JRA02',message='Repeated request.';end if;
  if (select count(*) from public.jr_ai_requests where user_id=uid and created_at>now()-interval '1 minute')>=6
   or (select count(*) from public.jr_ai_requests where user_id=uid and created_at>=date_trunc('day',now()))>=40
   or (select count(*) from public.jr_ai_requests where created_at>=date_trunc('day',now()))>=200 then raise exception using errcode='JRA01',message='AI budget reached.';end if;
  if exists(select 1 from public.jr_ai_requests where user_id=uid and status='running' and created_at>now()-interval '90 seconds')
   or (select count(*) from public.jr_ai_requests where status='running' and created_at>now()-interval '90 seconds')>=6 then raise exception using errcode='JRA02',message='An AI request is already running.';end if;
  prompt:=coalesce(payload->>'prompt','');
  if length(prompt)>4000 then raise exception using errcode='JRA03',message='Prompt too long.';end if;
  if mode in ('chat','mention') and length(trim(prompt))<1 then raise exception using errcode='JRA03',message='Write a prompt.';end if;
  if mode='mention' and payload->>'invocation' is distinct from 'action' and prompt !~* '^\s*(@jorata\M|/ai\M)' then raise exception using errcode='JRA03',message='Explicit invocation required.';end if;
  select coalesce(array_agg(v::uuid),'{}') into mids from jsonb_array_elements_text(coalesce(payload->'message_ids','[]')) v;
  if cardinality(mids)>30 then raise exception using errcode='JRA03',message='Select at most 30 messages.';end if;
  if cardinality(mids)=0 and coalesce((payload->>'include_recent')::boolean,false) then
   select coalesce(array_agg(id),'{}') into mids from (select id from public.jr_messages where room_id=rid and not deleted and length(body)>0 order by created_at desc,id desc limit 20) m;
  end if;
  if exists(select 1 from unnest(mids) selected where not exists(select 1 from public.jr_messages where id=selected and room_id=rid and not deleted)) then raise exception using errcode='42501',message='Selected messages unavailable.';end if;
  source_mid:=nullif(payload->>'source_message_id','')::uuid;
  if source_mid is not null and not exists(select 1 from public.jr_messages where id=source_mid and room_id=rid and sender_id=uid and not deleted and body=prompt) then raise exception using errcode='42501',message='Invocation message unavailable.';end if;
  if coalesce((payload->>'include_tasks')::boolean,false) and mode='tasks_suggest' then
   select coalesce(array_agg(id),'{}') into tids from (select id from public.jr_tasks where room_id=rid and not deleted order by updated_at desc limit 20) t;
  end if;
  if mode='username' and (cardinality(mids)>0 or cardinality(tids)>0) then raise exception using errcode='JRA03',message='Name reviews cannot include messages.';end if;
  ctx:=private.jr_ai_context(rid,mids,tids);
  if octet_length(ctx::text)>38000 then raise exception using errcode='JRA03',message='Select less context.';end if;
  fingerprint:=encode(extensions.digest(ctx::text,'sha256'),'hex');
  if mode='chat' then
   insert into public.jr_messages(room_id,sender_id,body) values(rid,uid,prompt) returning id into source_mid;
  end if;
  insert into public.jr_ai_requests(id,user_id,room_id,mode,input_hash,context_ids,task_ids,context_hash,source_message_id,source_hash) values(reqid,uid,rid,mode,ihash,mids,tids,fingerprint,source_mid,case when source_mid is not null then encode(extensions.digest(prompt,'sha256'),'hex') end);
  return jsonb_build_object('cached',false,'context',ctx,'room_id',rid,'source_message_id',source_mid);
 end if;
 reqid:=(payload->>'request_id')::uuid;
 select * into job from public.jr_ai_requests where id=reqid and user_id=uid for update;
 if not found or (job.room_id is not null and not private.jr_room_access(job.room_id)) then raise exception using errcode='42501',message='Request unavailable.';end if;
 if operation='fail' then
  update public.jr_ai_requests set status='failed',error_code=left(coalesce(payload->>'code','AI_UNAVAILABLE'),60),completed_at=now() where id=reqid and status='running';
  return '{}'::jsonb;
 end if;
 if operation='finish' then
  if job.status<>'running' or job.created_at<now()-interval '90 seconds' then raise exception using errcode='JRA02',message='Request expired.';end if;
  select * into room from public.jr_rooms where id=job.room_id;
  if room.kind in ('group','channel') and not exists(select 1 from public.jr_room_ai_settings where room_id=room.id and enabled) then raise exception using errcode='42501',message='Group AI was disabled.';end if;
  ctx:=private.jr_ai_context(job.room_id,job.context_ids,job.task_ids);
  if encode(extensions.digest(ctx::text,'sha256'),'hex')<>job.context_hash or (job.source_message_id is not null and not exists(select 1 from public.jr_messages where id=job.source_message_id and not deleted and encode(extensions.digest(body,'sha256'),'hex')=job.source_hash)) then raise exception using errcode='JRA02',message='Context changed.';end if;
  item:=payload->'result';
  if jsonb_typeof(item)<>'object' or length(item->>'text') not between 1 and 12000 then raise exception using errcode='JRA03',message='Invalid AI output.';end if;
  if job.mode in ('chat','mention') then
   insert into public.jr_messages(room_id,sender_id,bot_id,body,reply_to) values(job.room_id,null,'jorata-ai',item->>'text',job.source_message_id) returning id into result_mid;
   update public.jr_rooms set updated_at=now() where id=job.room_id;
  end if;
  update public.jr_ai_requests set status='done',result=item,result_message_id=result_mid,model=left(payload->>'model',100),input_tokens=least(greatest(coalesce((payload->>'input_tokens')::int,0),0),100000),output_tokens=least(greatest(coalesce((payload->>'output_tokens')::int,0),0),10000),completed_at=now() where id=reqid;
  return jsonb_build_object('message_id',result_mid,'room_id',job.room_id);
 end if;
 if operation='confirm_tasks' then
  if job.status<>'done' or job.mode<>'tasks_suggest' or (payload->>'confirmation')::boolean is distinct from true then raise exception using errcode='JRA03',message='Explicit task confirmation required.';end if;
  if job.confirmed_task_ids is not null then return jsonb_build_object('task_ids',job.confirmed_task_ids,'cached',true);end if;
  if job.created_at<now()-interval '1 day' then raise exception using errcode='JRA02',message='Task proposal expired.';end if;
  if jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items') not between 1 and 8 then raise exception using errcode='JRA03',message='Select one to eight tasks.';end if;
  if (select count(*) from jsonb_array_elements(payload->'items'))<>(select count(distinct value->>'index') from jsonb_array_elements(payload->'items')) then raise exception using errcode='JRA03',message='Duplicate tasks.';end if;
  proposals:=job.result->'tasks';
  for item in select value from jsonb_array_elements(payload->'items') loop
   idx:=(item->>'index')::int;
   if idx is null or idx<0 or idx>=jsonb_array_length(proposals) then raise exception using errcode='JRA03',message='Invalid task selection.';end if;
   task_result:=private.jr_action('task_save',jsonb_build_object('room_id',job.room_id,'title',proposals->idx->>'title','details',proposals->idx->>'details','assignee_id',item->>'assignee_id','due_date',item->>'due_date'));
   created:=created||jsonb_build_array(task_result->>'id');
  end loop;
  update public.jr_ai_requests set confirmed_task_ids=created where id=reqid;
  return jsonb_build_object('task_ids',created,'cached',false);
 end if;
 raise exception using errcode='JRA03',message='Unknown AI operation.';
end $$;
create function public.jr_ai_backend(operation text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.jr_ai_backend(operation,payload) $$;
revoke all on function private.jr_require_backend(),private.jr_ai_context(uuid,uuid[],uuid[]),private.jr_ai_backend(text,jsonb),public.jr_ai_backend(text,jsonb) from public,anon,authenticated;
grant execute on function private.jr_ai_backend(text,jsonb),public.jr_ai_backend(text,jsonb) to authenticated;

-- Server-derived identity for activity. No client-provided presence keys or typing IDs.
create table public.jr_activity (
 user_id uuid primary key references public.jr_profiles on delete cascade,
 room_id uuid references public.jr_rooms on delete cascade,
 last_seen timestamptz not null default now(),
 typing_until timestamptz
);
create index jr_activity_room on public.jr_activity(room_id);
alter table public.jr_activity enable row level security;
revoke all on public.jr_activity from public,anon,authenticated;
grant select on public.jr_activity to authenticated;
create policy jr_activity_read on public.jr_activity for select to authenticated using((select private.jr_session_active()) and (room_id is null or private.jr_room_access(room_id)));
create function private.jr_touch(room_id uuid default null,typing boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.jr_session_active() or not exists(select 1 from public.jr_profiles where id=auth.uid()) then raise exception using errcode='42501',message='Sign in first.';end if;
 if room_id is not null and not private.jr_room_access(room_id) then raise exception using errcode='42501',message='Conversation unavailable.';end if;
 perform private.jr_limit('activity',80);
 insert into public.jr_activity values(auth.uid(),room_id,now(),case when typing then now()+interval '4 seconds' else null end)
 on conflict(user_id) do update set room_id=excluded.room_id,last_seen=now(),typing_until=excluded.typing_until;
end $$;
create function public.jr_touch(room_id uuid default null,typing boolean default false) returns void language sql security invoker set search_path='' as $$ select private.jr_touch(room_id,typing) $$;
revoke all on function private.jr_touch(uuid,boolean),public.jr_touch(uuid,boolean) from public,anon;
grant execute on function private.jr_touch(uuid,boolean),public.jr_touch(uuid,boolean) to authenticated;
alter publication supabase_realtime add table public.jr_activity,public.jr_room_ai_settings;

-- Deterministic flood/repetition checks protect all message writes, including RPC clients.
create function private.jr_message_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.sender_id is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text,0));
 if (select count(*) from public.jr_messages where sender_id=new.sender_id and created_at>now()-interval '10 seconds')>=8 then raise exception using errcode='JRA01',message='Message flood limit. Try again shortly.';end if;
 if length(trim(new.body))>0 and (select count(*) from public.jr_messages where sender_id=new.sender_id and room_id=new.room_id and created_at>now()-interval '1 minute' and not deleted and lower(trim(body))=lower(trim(new.body)))>=3 then raise exception using errcode='JRA01',message='Repeated message limit. Wait before sending again.';end if;
 return new;
end $$;
create trigger jr_message_guard before insert on public.jr_messages for each row execute function private.jr_message_guard();
create function private.jr_report_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.message_id is not null and not exists(select 1 from public.jr_messages where id=new.message_id and sender_id=new.reported_id and private.jr_room_access(room_id)) then raise exception using errcode='42501',message='Report target does not match the message.';end if;
 return new;
end $$;
create trigger jr_report_guard before insert on public.jr_reports for each row execute function private.jr_report_guard();
revoke all on function private.jr_message_guard(),private.jr_report_guard() from public,anon,authenticated;

-- Reserve the bot identity as well as existing platform staff names. Registration and updates use this function.
create or replace function private.jr_safe_name(value text) returns text language plpgsql immutable set search_path='' as $$
declare cleaned text:=trim(normalize(coalesce(value,''),NFKC));folded text;staff text;
begin
 folded:=regexp_replace(translate(translate(lower(cleaned),'аеорсхіјуѕӏαεορχιυ','aeopcxijyslaeopxiy'),'013457@$!','oieastasi'),'[^a-z0-9]','','g');
 staff:=regexp_replace(translate(regexp_replace(translate(lower(cleaned),'аеорсхіјуѕӏαεορχιυ','aeopcxijyslaeopxiy'),'[0-9]+$',''),'013457@$!','oieastasi'),'[^a-z0-9]','','g');
 if length(cleaned)<2 or length(cleaned)>60 or cleaned~'[[:cntrl:]]' or staff~'^(admin|administrator|moderator|officialsupport|jorataofficial|joratasupport|system|supportteam|jorata|jorataai|jorataaibot)$' or folded~'(fuck|nigger|nigga|faggot)' or lower(cleaned)~'(^|[^a-z])(shit|bitch|cunt|kike|chink)([^a-z]|$)' or folded in ('shit','bitch','cunt','kike','chink') then raise exception 'Please choose a different name. Avoid offensive words and reserved staff names.';end if;
 return cleaned;
end $$;
