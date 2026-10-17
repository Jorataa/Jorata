-- Nullable bot senders must never bypass the human ownership check.
-- Patch existing routines additively and fail if the expected implementation differs.
do $patch$
declare definition text; original text;
begin
 definition := pg_get_functiondef('private.jr_action_core(text,jsonb)'::regprocedure);
 original := definition;
 definition := replace(definition,
  'if message.sender_id<>uid then',
  'if message.sender_id is distinct from uid then');
 if definition = original then raise exception 'Message ownership patch did not match.'; end if;
 execute definition;

 definition := pg_get_functiondef('private.jr_ai_backend(text,jsonb)'::regprocedure);
 original := definition;
 definition := replace(definition,
  $old$if job.status='done' then$old$,
  $new$if job.status='done' then
    -- The invocation may not be among the selected context IDs. Check it separately.
    if job.source_message_id is not null and not exists(
     select 1 from public.jr_messages where id=job.source_message_id
      and room_id=job.room_id and not deleted
      and encode(extensions.digest(body,'sha256'),'hex')=job.source_hash
    ) then raise exception using errcode='JRA02',message='Invocation changed.';end if;
    -- Never replay an answer that was removed or changed after publication.
    if job.result_message_id is not null and not exists(
     select 1 from public.jr_messages where id=job.result_message_id
      and room_id=job.room_id and not deleted and bot_id='jorata-ai'
      and body=job.result->>'text'
    ) then raise exception using errcode='JRA02',message='Answer unavailable.';end if;$new$);
 if definition = original then raise exception 'AI replay patch did not match.'; end if;
 execute definition;
end $patch$;
