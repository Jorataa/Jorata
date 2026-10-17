-- Additive social schema. Existing game saves and any previous application data are untouched.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.jr_profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (length(display_name) between 2 and 40),
  bio text not null default '' check (length(bio) <= 240),
  avatar_path text,
  created_at timestamptz not null default now()
);
create table public.jr_communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 60),
  owner_id uuid not null references public.jr_profiles,
  created_at timestamptz not null default now()
);
create table public.jr_community_members (
  community_id uuid references public.jr_communities on delete cascade,
  user_id uuid references public.jr_profiles on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  primary key (community_id,user_id)
);
create index jr_community_members_user on public.jr_community_members(user_id);
create table public.jr_rooms (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct','group','channel')),
  name text not null default '' check (length(name) <= 60),
  owner_id uuid not null references public.jr_profiles,
  community_id uuid references public.jr_communities on delete cascade,
  dm_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'channel') = (community_id is not null)),
  check ((kind = 'direct') = (dm_key is not null))
);
create index jr_rooms_community on public.jr_rooms(community_id);
create table public.jr_room_members (
  room_id uuid references public.jr_rooms on delete cascade,
  user_id uuid references public.jr_profiles on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  primary key (room_id,user_id)
);
create index jr_room_members_user on public.jr_room_members(user_id);
create table public.jr_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.jr_rooms on delete cascade,
  sender_id uuid not null references public.jr_profiles,
  body text not null default '' check (length(body) <= 4000),
  attachment_path text,
  reply_to uuid references public.jr_messages,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index jr_messages_room_time on public.jr_messages(room_id,created_at desc,id);
create index jr_messages_sender on public.jr_messages(sender_id);
create index jr_messages_reply on public.jr_messages(reply_to);
create table public.jr_reactions (
  message_id uuid references public.jr_messages on delete cascade,
  user_id uuid references public.jr_profiles on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','🎉','👀','👋')),
  active boolean not null default true,
  primary key (message_id,user_id,emoji)
);
create table public.jr_tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.jr_rooms on delete cascade,
  creator_id uuid not null references public.jr_profiles,
  title text not null check (length(title) between 1 and 160),
  details text not null default '' check (length(details) <= 2000),
  assignee_id uuid references public.jr_profiles,
  due_date date,
  completed boolean not null default false,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index jr_tasks_room on public.jr_tasks(room_id);
create index jr_tasks_creator on public.jr_tasks(creator_id);
create index jr_tasks_assignee on public.jr_tasks(assignee_id);
create table public.jr_blocks (
  user_id uuid references public.jr_profiles on delete cascade,
  blocked_id uuid references public.jr_profiles on delete cascade,
  primary key (user_id,blocked_id), check (user_id <> blocked_id)
);
create index jr_blocks_target on public.jr_blocks(blocked_id);
create table public.jr_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.jr_profiles,
  reported_id uuid not null references public.jr_profiles,
  message_id uuid references public.jr_messages,
  reason text not null check (length(reason) between 3 and 1000),
  created_at timestamptz not null default now()
);
create index jr_reports_reporter on public.jr_reports(reporter_id);
create index jr_reports_reported on public.jr_reports(reported_id);
create index jr_reports_message on public.jr_reports(message_id);
create table public.jr_world_tiles (
  x integer not null check (x between 0 and 95),
  y integer not null check (y between 0 and 38),
  tile integer not null check (tile in (0,4,6,7)),
  editor_id uuid not null references public.jr_profiles,
  primary key (x,y)
);
create index jr_world_editor on public.jr_world_tiles(editor_id);
create table private.jr_limits (
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  window_id bigint not null,
  count integer not null,
  primary key (user_id,kind)
);
alter table private.jr_limits enable row level security;

-- These helpers intentionally bypass membership-table RLS to avoid recursive policies.
-- They are not exposed through PostgREST and always bind authorization to auth.uid().
create function private.jr_community_role(cid uuid) returns text language sql stable security definer set search_path = '' as $$
  select role from public.jr_community_members where community_id=cid and user_id=(select auth.uid())
$$;
create function private.jr_room_access(rid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.jr_rooms r where r.id=rid and (
      exists(select 1 from public.jr_room_members m where m.room_id=r.id and m.user_id=(select auth.uid()))
      or exists(select 1 from public.jr_community_members m where m.community_id=r.community_id and m.user_id=(select auth.uid()))
    )
  )
$$;
create function private.jr_room_admin(rid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.jr_rooms r where r.id=rid and (
      exists(select 1 from public.jr_room_members m where m.room_id=r.id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
      or exists(select 1 from public.jr_community_members m where m.community_id=r.community_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
    )
  )
$$;
create function private.jr_message_access(mid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists(select 1 from public.jr_messages where id=mid and private.jr_room_access(room_id))
$$;
create function private.jr_topic_access(topic text) returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  if topic in ('jr-presence','jr-world:meadow') then return exists(select 1 from public.jr_profiles where id=auth.uid()); end if;
  if topic ~ '^jr-room:[0-9a-f-]{36}$' then return private.jr_room_access(substring(topic from 9)::uuid); end if;
  return false;
exception when invalid_text_representation then return false;
end $$;
create function private.jr_safe_name(value text) returns text language plpgsql immutable set search_path = '' as $$
declare cleaned text := trim(normalize(coalesce(value,''),NFKC)); folded text;
begin
  folded := regexp_replace(translate(lower(cleaned),'013457@$!','oieastasi'),'[^a-z0-9]','','g');
  if length(cleaned) < 2 or length(cleaned) > 60 or cleaned ~ '[[:cntrl:]]'
    or folded ~ '^(admin|administrator|moderator|officialsupport|jorataofficial|joratasupport|system|supportteam)$'
    or folded ~ '(fuck|nigger|nigga|faggot)'
    or lower(cleaned) ~ '(^|[^a-z])(shit|bitch|cunt|kike|chink)([^a-z]|$)'
    or folded in ('shit','bitch','cunt','kike','chink') then
    raise exception 'Please choose a different name. Avoid offensive words and reserved staff names.';
  end if;
  return cleaned;
end $$;
create function private.jr_limit(kind text, maximum integer) returns void language plpgsql security definer set search_path = '' as $$
declare amount integer; bucket bigint := floor(extract(epoch from now())/60);
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into private.jr_limits as l values(auth.uid(),kind,bucket,1)
    on conflict (user_id,kind) do update set window_id=bucket, count=case when l.window_id=bucket then l.count+1 else 1 end
    returning count into amount;
  if amount > maximum then raise exception 'Please slow down and try again in a minute.'; end if;
end $$;

-- One authenticated mutation boundary: no client has direct write grants to application tables.
create function private.jr_action(action text, payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); rid uuid; cid uuid; mid uuid; target uuid; result_id uuid;
  room public.jr_rooms; message public.jr_messages; task public.jr_tasks;
  label text; handle text; media text; pair text; item jsonb; actor_role text;
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if octet_length(payload::text) > 20000 then raise exception 'Request is too large.'; end if;
  perform private.jr_limit('actions',150);
  if action in ('profile','profile_update') then
    label := private.jr_safe_name(payload->>'display_name');
    handle := lower(normalize(trim(payload->>'username'),NFKC));
    perform private.jr_safe_name(handle);
    if handle is null or handle !~ '^[a-z0-9_]{3,24}$' or length(label)>40 then raise exception 'Use 3–24 letters, numbers or underscores for your username.'; end if;
    media := nullif(payload->>'avatar_path','');
    if media is not null and (split_part(media,'/',1)<>uid::text or not exists(select 1 from storage.objects where bucket_id='jr-avatars' and name=media)) then raise exception 'Upload your own profile image first.'; end if;
    insert into public.jr_profiles(id,username,display_name,bio,avatar_path) values(uid,handle,label,coalesce(payload->>'bio',''),media)
      on conflict(id) do update set username=excluded.username,display_name=excluded.display_name,bio=excluded.bio,avatar_path=excluded.avatar_path;
    return jsonb_build_object('id',uid);
  end if;
  if not exists(select 1 from public.jr_profiles where id=uid) then raise exception 'Complete your profile first.'; end if;
  if action='open_dm' then
    perform private.jr_limit('new_rooms',15);
    target := (payload->>'user_id')::uuid;
    if target=uid or not exists(select 1 from public.jr_profiles where id=target) then raise exception 'Choose another explorer.'; end if;
    if exists(select 1 from public.jr_blocks where (user_id=uid and blocked_id=target) or (user_id=target and blocked_id=uid)) then raise exception 'This conversation is unavailable.'; end if;
    pair := least(uid::text,target::text)||':'||greatest(uid::text,target::text);
    insert into public.jr_rooms(kind,owner_id,dm_key) values('direct',uid,pair) on conflict(dm_key) do update set dm_key=excluded.dm_key returning id into rid;
    insert into public.jr_room_members values(rid,uid,'member'),(rid,target,'member') on conflict do nothing;
    return jsonb_build_object('id',rid);
  elsif action='create_group' then
    perform private.jr_limit('new_rooms',15);
    label := private.jr_safe_name(payload->>'name');
    insert into public.jr_rooms(kind,name,owner_id) values('group',label,uid) returning id into rid;
    insert into public.jr_room_members values(rid,uid,'owner');
    return jsonb_build_object('id',rid);
  elsif action='create_community' then
    perform private.jr_limit('new_rooms',15);
    label := private.jr_safe_name(payload->>'name');
    insert into public.jr_communities(name,owner_id) values(label,uid) returning id into cid;
    insert into public.jr_community_members values(cid,uid,'owner');
    insert into public.jr_rooms(kind,name,owner_id,community_id) values('channel','general',uid,cid) returning id into rid;
    return jsonb_build_object('id',cid,'room_id',rid);
  elsif action in ('join_community','community_role','remove_community_member','create_channel') then
    cid := (payload->>'community_id')::uuid;
    actor_role := private.jr_community_role(cid);
    if action='join_community' then
      insert into public.jr_community_members values(cid,uid,'member') on conflict do nothing;
      return jsonb_build_object('id',cid);
    end if;
    if actor_role is null or actor_role not in ('owner','admin') then raise exception 'Community admin permission required.'; end if;
    if action='create_channel' then
      label := private.jr_safe_name(payload->>'name');
      insert into public.jr_rooms(kind,name,owner_id,community_id) values('channel',label,uid,cid) returning id into rid;
      return jsonb_build_object('id',rid);
    end if;
    target := (payload->>'user_id')::uuid;
    if exists(select 1 from public.jr_community_members where community_id=cid and user_id=target and role='owner') then raise exception 'The community owner cannot be removed or demoted.'; end if;
    if action='community_role' then
      if actor_role<>'owner' or payload->>'role' not in ('admin','member') then raise exception 'Only the owner can assign admin roles.'; end if;
      update public.jr_community_members set role=payload->>'role' where community_id=cid and user_id=target;
    else
      if actor_role<>'owner' and exists(select 1 from public.jr_community_members where community_id=cid and user_id=target and role='admin') then raise exception 'Only the owner can remove an admin.'; end if;
      delete from public.jr_community_members where community_id=cid and user_id=target;
    end if;
    return '{}'::jsonb;
  elsif action in ('block','unblock','report') then
    target := (payload->>'user_id')::uuid;
    if target=uid then raise exception 'Choose another explorer.'; end if;
    if action='block' then insert into public.jr_blocks values(uid,target) on conflict do nothing;
    elsif action='unblock' then delete from public.jr_blocks where user_id=uid and blocked_id=target;
    else
      perform private.jr_limit('reports',5);
      mid := nullif(payload->>'message_id','')::uuid;
      if mid is not null and not private.jr_message_access(mid) then raise exception 'Message unavailable.'; end if;
      insert into public.jr_reports(reporter_id,reported_id,message_id,reason) values(uid,target,mid,payload->>'reason');
    end if;
    return '{}'::jsonb;
  elsif action='world_edit' then
    perform private.jr_limit('world_edit',120);
    if (payload->>'x')::int between 10 and 15 and (payload->>'y')::int between 24 and 29 then raise exception 'The arrival area stays protected.'; end if;
    insert into public.jr_world_tiles values((payload->>'x')::int,(payload->>'y')::int,(payload->>'tile')::int,uid)
      on conflict(x,y) do update set tile=excluded.tile,editor_id=uid;
    return '{}'::jsonb;
  end if;

  rid := nullif(payload->>'room_id','')::uuid;
  if not private.jr_room_access(rid) then raise exception 'You are not a member of this conversation.'; end if;
  select * into room from public.jr_rooms where id=rid;
  if action in ('add_member','remove_member','rename_room') then
    if room.kind<>'group' or not private.jr_room_admin(rid) then raise exception 'Group admin permission required.'; end if;
    if action='rename_room' then update public.jr_rooms set name=private.jr_safe_name(payload->>'name'),updated_at=now() where id=rid;
    else
      target := (payload->>'user_id')::uuid;
      if action='add_member' then
        if exists(select 1 from public.jr_blocks where (user_id=uid and blocked_id=target) or (user_id=target and blocked_id=uid)) then raise exception 'This invitation is unavailable.'; end if;
        insert into public.jr_room_members values(rid,target,'member') on conflict do nothing;
      else
        if room.owner_id=target then raise exception 'The group owner cannot be removed.'; end if;
        delete from public.jr_room_members where room_id=rid and user_id=target;
      end if;
    end if;
  elsif action='leave_room' then
    if room.kind='direct' then raise exception 'Direct conversations remain in your history. You can block the other user.'; end if;
    if room.owner_id=uid then raise exception 'Owners must keep their group or community membership.'; end if;
    if room.kind='channel' then delete from public.jr_community_members where community_id=room.community_id and user_id=uid;
    else delete from public.jr_room_members where room_id=rid and user_id=uid; end if;
  elsif action='send_message' then
    perform private.jr_limit('messages',40);
    if room.kind='direct' and exists(select 1 from public.jr_room_members m join public.jr_blocks b on
      (b.user_id=uid and b.blocked_id=m.user_id) or (b.blocked_id=uid and b.user_id=m.user_id) where m.room_id=rid) then raise exception 'This conversation is unavailable.'; end if;
    media := nullif(payload->>'attachment_path','');
    if media is not null and (split_part(media,'/',1)<>rid::text or split_part(media,'/',2)<>uid::text or not exists(select 1 from storage.objects where bucket_id='jr-media' and name=media)) then raise exception 'Upload the photo to this conversation first.'; end if;
    if length(trim(coalesce(payload->>'body','')))=0 and media is null then raise exception 'Write a message or attach a photo.'; end if;
    mid := nullif(payload->>'reply_to','')::uuid;
    if mid is not null and not exists(select 1 from public.jr_messages where id=mid and room_id=rid) then raise exception 'Reply must belong to this conversation.'; end if;
    insert into public.jr_messages(room_id,sender_id,body,attachment_path,reply_to) values(rid,uid,trim(coalesce(payload->>'body','')),media,mid) returning id into result_id;
    update public.jr_rooms set updated_at=now() where id=rid;
    return jsonb_build_object('id',result_id);
  elsif action in ('edit_message','delete_message','react') then
    mid := (payload->>'message_id')::uuid;
    select * into message from public.jr_messages where id=mid and room_id=rid and not deleted;
    if not found then raise exception 'Message unavailable.'; end if;
    if action='react' then
      insert into public.jr_reactions values(mid,uid,payload->>'emoji',true) on conflict(message_id,user_id,emoji) do update set active=not jr_reactions.active;
    else
      if message.sender_id<>uid then raise exception 'You can only change your own messages.'; end if;
      if action='delete_message' then update public.jr_messages set deleted=true,body='',attachment_path=null,edited_at=now() where id=mid;
      else
        label := trim(payload->>'body');
        if coalesce(length(label),0)=0 then raise exception 'Write a message.'; end if;
        update public.jr_messages set body=label,edited_at=now() where id=mid;
      end if;
    end if;
  elsif action in ('task_save','task_delete') then
    mid := nullif(payload->>'id','')::uuid;
    if mid is not null then
      select * into task from public.jr_tasks where id=mid and room_id=rid and not deleted;
      if not found then raise exception 'Task unavailable.'; end if;
      if action='task_delete' then
        if task.creator_id<>uid and not private.jr_room_admin(rid) then raise exception 'Only the creator or an admin can delete this task.'; end if;
        update public.jr_tasks set deleted=true,updated_at=now() where id=mid;
        return '{}'::jsonb;
      end if;
    end if;
    target := nullif(payload->>'assignee_id','')::uuid;
    if target is not null and not exists(select 1 from public.jr_room_members where room_id=rid and user_id=target) and not exists(select 1 from public.jr_community_members where community_id=room.community_id and user_id=target) then raise exception 'Assign tasks to a conversation member.'; end if;
    insert into public.jr_tasks(id,room_id,creator_id,title,details,assignee_id,due_date,completed)
      values(coalesce(mid,gen_random_uuid()),rid,coalesce(task.creator_id,uid),trim(payload->>'title'),coalesce(payload->>'details',''),target,nullif(payload->>'due_date','')::date,coalesce((payload->>'completed')::boolean,false))
      on conflict(id) do update set title=excluded.title,details=excluded.details,assignee_id=excluded.assignee_id,due_date=excluded.due_date,completed=excluded.completed,updated_at=now() returning id into result_id;
    return jsonb_build_object('id',result_id);
  else raise exception 'Unknown action.';
  end if;
  return '{}'::jsonb;
end $$;
create function public.jr_action(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path = '' as $$
  select private.jr_action(action,payload)
$$;

-- Auth owns password handling. This trigger validates and reserves the name atomically at signup.
create function private.jr_on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
declare handle text; label text;
begin
  handle := lower(normalize(trim(new.raw_user_meta_data->>'username'),NFKC));
  label := private.jr_safe_name(new.raw_user_meta_data->>'display_name');
  perform private.jr_safe_name(handle);
  if handle is null or handle !~ '^[a-z0-9_]{3,24}$' or length(label)>40 then raise exception 'Choose a valid unique username.'; end if;
  insert into public.jr_profiles(id,username,display_name) values(new.id,handle,label);
  return new;
end $$;
create trigger jr_auth_signup after insert on auth.users for each row execute function private.jr_on_signup();

-- Explicit grants + RLS: authentication alone never grants access to a private room.
do $$ declare t text; begin
  foreach t in array array['jr_profiles','jr_communities','jr_community_members','jr_rooms','jr_room_members','jr_messages','jr_reactions','jr_tasks','jr_blocks','jr_reports','jr_world_tiles'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
create policy jr_profiles_read on public.jr_profiles for select to authenticated using (true);
create policy jr_communities_read on public.jr_communities for select to authenticated using (true);
create policy jr_community_members_read on public.jr_community_members for select to authenticated using (private.jr_community_role(community_id) is not null);
create policy jr_rooms_read on public.jr_rooms for select to authenticated using (private.jr_room_access(id));
create policy jr_room_members_read on public.jr_room_members for select to authenticated using (private.jr_room_access(room_id));
create policy jr_messages_read on public.jr_messages for select to authenticated using (private.jr_room_access(room_id));
create policy jr_reactions_read on public.jr_reactions for select to authenticated using (private.jr_message_access(message_id));
create policy jr_tasks_read on public.jr_tasks for select to authenticated using (private.jr_room_access(room_id));
create policy jr_blocks_read on public.jr_blocks for select to authenticated using (user_id=(select auth.uid()));
create policy jr_reports_read on public.jr_reports for select to authenticated using (reporter_id=(select auth.uid()));
create policy jr_world_read on public.jr_world_tiles for select to authenticated using (true);
revoke all on all functions in schema private from public,anon;
grant execute on all functions in schema private to authenticated;
revoke all on function public.jr_action(text,jsonb) from public,anon;
grant execute on function public.jr_action(text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('jr-media','jr-media',false,5242880,array['image/jpeg','image/png','image/webp']),
  ('jr-avatars','jr-avatars',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy jr_media_read on storage.objects for select to authenticated using
  (bucket_id='jr-media' and private.jr_topic_access('jr-room:'||split_part(name,'/',1)));
create policy jr_media_insert on storage.objects for insert to authenticated with check
  (bucket_id='jr-media' and split_part(name,'/',2)=(select auth.uid())::text and private.jr_topic_access('jr-room:'||split_part(name,'/',1)));
create policy jr_media_delete on storage.objects for delete to authenticated using
  (bucket_id='jr-media' and split_part(name,'/',2)=(select auth.uid())::text);
create policy jr_avatar_read on storage.objects for select to authenticated using (bucket_id='jr-avatars');
create policy jr_avatar_insert on storage.objects for insert to authenticated with check
  (bucket_id='jr-avatars' and split_part(name,'/',1)=(select auth.uid())::text);
create policy jr_avatar_delete on storage.objects for delete to authenticated using
  (bucket_id='jr-avatars' and split_part(name,'/',1)=(select auth.uid())::text);
create policy jr_realtime_read on realtime.messages for select to authenticated using (private.jr_topic_access(realtime.topic()));
create policy jr_realtime_write on realtime.messages for insert to authenticated with check (private.jr_topic_access(realtime.topic()));
alter publication supabase_realtime add table public.jr_messages,public.jr_rooms,public.jr_reactions,public.jr_tasks,public.jr_world_tiles;
