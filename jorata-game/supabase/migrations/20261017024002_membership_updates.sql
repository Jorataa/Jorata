-- Publish room updates when group membership changes.
create or replace function private.jr_action(action text, payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
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
    update public.jr_rooms set updated_at=now() where id=rid;
  elsif action='leave_room' then
    if room.kind='direct' then raise exception 'Direct conversations remain in your history. You can block the other user.'; end if;
    if (room.kind='group' and room.owner_id=uid) or (room.kind='channel' and private.jr_community_role(room.community_id)='owner') then raise exception 'Owners must keep their group or community membership.'; end if;
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
