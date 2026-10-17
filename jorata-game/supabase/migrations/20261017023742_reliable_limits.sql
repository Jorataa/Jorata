create or replace function private.jr_limit(kind text, maximum integer) returns void language plpgsql security definer set search_path = '' as $$
declare amount integer; bucket bigint := floor(extract(epoch from now())/60);
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into private.jr_limits as l values(auth.uid(),jr_limit.kind,bucket,1)
    on conflict on constraint jr_limits_pkey do update set window_id=bucket, count=case when l.window_id=bucket then l.count+1 else 1 end
    returning count into amount;
  if amount > maximum then raise exception 'Please slow down and try again in a minute.'; end if;
end $$;

create function private.jr_ai_quota(room_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare amount integer; bucket bigint := floor(extract(epoch from now())/86400);
begin
  if auth.uid() is null or not private.jr_room_access(room_id) then raise exception 'Conversation unavailable.'; end if;
  perform private.jr_limit('ai_minute',2);
  insert into private.jr_limits as l values(auth.uid(),'ai_daily',bucket,1)
    on conflict on constraint jr_limits_pkey do update set window_id=bucket,count=case when l.window_id=bucket then l.count+1 else 1 end returning count into amount;
  if amount>20 then raise exception 'Daily AI limit reached. Try again tomorrow.'; end if;
end $$;
create function public.jr_ai_quota(room_id uuid) returns void language sql security invoker set search_path = '' as $$ select private.jr_ai_quota(room_id) $$;
revoke all on function private.jr_ai_quota(uuid), public.jr_ai_quota(uuid) from public,anon;
grant execute on function private.jr_ai_quota(uuid), public.jr_ai_quota(uuid) to authenticated;
