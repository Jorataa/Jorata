-- Every bot message names the real user who explicitly invoked it.
alter table public.jr_messages add column ai_requested_by uuid references public.jr_profiles;
update public.jr_messages m set ai_requested_by=r.user_id from public.jr_ai_requests r where r.result_message_id=m.id and m.bot_id is not null;
alter table public.jr_messages add constraint jr_ai_attribution check((bot_id is null and ai_requested_by is null) or (bot_id is not null and ai_requested_by is not null));
create index jr_messages_ai_requester on public.jr_messages(ai_requested_by) where ai_requested_by is not null;
alter policy jr_ai_requests_read on public.jr_ai_requests using((select private.jr_session_active()) and user_id=(select auth.uid()) and (room_id is null or private.jr_room_access(room_id)));
alter policy jr_avatar_read on storage.objects using(bucket_id='jr-avatars' and (select private.jr_session_active()));
alter policy jr_avatar_insert on storage.objects with check(bucket_id='jr-avatars' and split_part(name,'/',1)=(select auth.uid())::text and (select private.jr_session_active()));
alter policy jr_avatar_delete on storage.objects using(bucket_id='jr-avatars' and split_part(name,'/',1)=(select auth.uid())::text and (select private.jr_session_active()));
alter policy jr_media_delete on storage.objects using(bucket_id='jr-media' and split_part(name,'/',2)=(select auth.uid())::text and (select private.jr_session_active()));

-- Patch the already-reviewed function without duplicating its implementation in another migration.
do $patch$
declare definition text;original text;
begin
 definition:=pg_get_functiondef('private.jr_ai_backend(text,jsonb)'::regprocedure);original:=definition;
 definition:=replace(definition,$old$insert into public.jr_messages(room_id,sender_id,bot_id,body,reply_to) values(job.room_id,null,'jorata-ai',item->>'text',job.source_message_id)$old$,$new$insert into public.jr_messages(room_id,sender_id,bot_id,body,reply_to,ai_requested_by) values(job.room_id,null,'jorata-ai',item->>'text',job.source_message_id,uid)$new$);
 if definition=original then raise exception 'AI attribution patch did not match.';end if;
 definition:=replace(definition,$old$if not found or (job.room_id is not null and not private.jr_room_access(job.room_id)) then$old$,$new$if not found then$new$);
 definition:=replace(definition,$old$if operation='finish' then$old$,$new$if job.room_id is not null and not private.jr_room_access(job.room_id) then raise exception using errcode='42501',message='Request unavailable.';end if;
 if operation='finish' then$new$);
 definition:=replace(definition,$old$proposals:=job.result->'tasks';$old$,$new$ctx:=private.jr_ai_context(job.room_id,job.context_ids,job.task_ids);
  if encode(extensions.digest(ctx::text,'sha256'),'hex')<>job.context_hash then raise exception using errcode='JRA02',message='Task context changed. Request a new proposal.';end if;
  proposals:=job.result->'tasks';
  if jsonb_typeof(proposals)<>'array' or jsonb_array_length(proposals) not between 1 and 8 then raise exception using errcode='JRA03',message='No usable task proposal.';end if;$new$);
 execute definition;
 definition:=pg_get_functiondef('private.jr_topic_access(text)'::regprocedure);
 definition:=replace(definition,'if auth.uid() is null then return false; end if;','if not private.jr_session_active() then return false; end if;');
 execute definition;
end $patch$;
