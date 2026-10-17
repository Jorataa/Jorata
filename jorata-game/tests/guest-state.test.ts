import test from "node:test";
import assert from "node:assert/strict";
import {
  createGuest,
  emptyState,
  guestAction,
  snapshot,
} from "../shared/guest-state.ts";
test("guest conversations enforce membership, sender identity, replies, reactions and task permissions", () => {
  const state = emptyState(),
    a = createGuest(state, "Guest A"),
    b = createGuest(state, "Guest B"),
    c = createGuest(state, "Guest C");
  const room = guestAction(state, a.id, "open_dm", { user_id: b.id }).id!;
  const m = guestAction(state, a.id, "send_message", {
    room_id: room,
    body: "Hello",
    sender_id: c.id,
  }).id!;
  assert.equal(snapshot(state, b.id).messages[0].sender_id, a.id);
  assert.equal(
    snapshot(state, c.id).rooms.some((r) => r.id === room),
    false,
  );
  assert.equal(snapshot(state, c.id).messages.length, 0);
  assert.throws(
    () =>
      guestAction(state, c.id, "send_message", {
        room_id: room,
        body: "Intrusion",
      }),
    /not a member/,
  );
  assert.throws(
    () =>
      guestAction(state, b.id, "edit_message", {
        room_id: room,
        message_id: m,
        body: "Spoof",
      }),
    /own messages/,
  );
  guestAction(state, b.id, "react", {
    room_id: room,
    message_id: m,
    emoji: "👍",
  });
  guestAction(state, b.id, "send_message", {
    room_id: room,
    reply_to: m,
    body: "Reply",
  });
  assert.equal(snapshot(state, a.id).messages[1].reply_to, m);
  assert.equal(snapshot(state, a.id).reactions.length, 1);
  guestAction(state, a.id, "task_save", {
    room_id: room,
    title: "Ship",
    assignee_id: b.id,
    due_date: "2026-12-01",
  });
  const task = state.tasks[0];
  guestAction(state, b.id, "task_save", { ...task, completed: true });
  assert.equal(task.completed, true);
  assert.throws(
    () =>
      guestAction(state, c.id, "task_save", { ...task, title: "Intrusion" }),
    /not a member/,
  );
  assert.throws(
    () => guestAction(state, a.id, "task_save", { ...task, assignee_id: c.id }),
    /only to members/,
  );
  const other = guestAction(state, a.id, "open_dm", { user_id: c.id }).id!;
  assert.throws(
    () =>
      guestAction(state, c.id, "send_message", {
        room_id: other,
        body: "Leak",
        reply_to: m,
      }),
    /Reply must/,
  );
});
test("communities and groups grant and revoke access, guest data is serializable", () => {
  const state = emptyState(),
    a = createGuest(state),
    b = createGuest(state),
    c = createGuest(state);
  const group = guestAction(state, a.id, "create_group", {
    name: "Study group",
  }).id!;
  guestAction(state, a.id, "add_member", { room_id: group, user_id: b.id });
  guestAction(state, a.id, "send_message", {
    room_id: group,
    body: "Private test message",
  });
  assert.equal(snapshot(state, b.id).messages.length, 1);
  guestAction(state, a.id, "remove_member", { room_id: group, user_id: b.id });
  assert.equal(snapshot(state, b.id).messages.length, 0);
  const community = guestAction(state, a.id, "create_community", {
    name: "Builders",
  }).id!;
  guestAction(state, b.id, "join_community", { community_id: community });
  assert.equal(
    snapshot(state, c.id).rooms.some((r) => r.community_id === community),
    false,
  );
  assert.throws(
    () =>
      guestAction(state, b.id, "create_channel", {
        community_id: community,
        name: "work",
      }),
    /admins/,
  );
  guestAction(state, a.id, "community_role", {
    community_id: community,
    user_id: b.id,
    role: "admin",
  });
  guestAction(state, b.id, "create_channel", {
    community_id: community,
    name: "work",
  });
  assert.equal(
    snapshot(state, b.id).rooms.filter((r) => r.community_id === community)
      .length,
    2,
  );
  assert.deepEqual(
    snapshot(JSON.parse(JSON.stringify(state)), a.id),
    snapshot(state, a.id),
  );
});
