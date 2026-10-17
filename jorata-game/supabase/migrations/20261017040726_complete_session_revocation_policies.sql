-- Complete revocation for remaining current-platform private metadata reads.
create or replace function private.jr_community_role(cid uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.jr_community_members where community_id=cid and user_id=(select auth.uid()) and private.jr_session_active()
$$;
alter policy jr_blocks_read on public.jr_blocks using((select private.jr_session_active()) and user_id=(select auth.uid()));
alter policy jr_reports_read on public.jr_reports using((select private.jr_session_active()) and reporter_id=(select auth.uid()));
