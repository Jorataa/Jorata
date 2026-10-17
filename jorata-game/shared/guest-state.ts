// Development/sample data only. Never a substitute for authenticated production authorization.
import { validateName } from "../src/social/moderation";
import type {
  Profile,
  Room,
  Member,
  Community,
  CommunityMember,
  ChatMessage,
  Reaction,
  Task,
} from "../src/social/types";
export type GuestState = {
  version: 1;
  profiles: Profile[];
  rooms: Room[];
  members: Member[];
  communities: Community[];
  communityMembers: CommunityMember[];
  messages: ChatMessage[];
  reactions: Reaction[];
  tasks: Task[];
  blocks: { user_id: string; target: string }[];
  reports: { user_id: string; target: string; reason: string }[];
  tiles: Record<string, number>;
};
export type GuestSnapshot = ReturnType<typeof snapshot>;
export type ActionResult = { id?: string; room_id?: string };
export const emptyState = (): GuestState => ({
  version: 1,
  profiles: [],
  rooms: [
    {
      id: "guest-lobby",
      kind: "group",
      name: "Guest lounge · test data",
      owner_id: "system",
      community_id: null,
      updated_at: new Date().toISOString(),
    },
  ],
  members: [],
  communities: [],
  communityMembers: [],
  messages: [],
  reactions: [],
  tasks: [],
  blocks: [],
  reports: [],
  tiles: {},
});
const id = () => crypto.randomUUID();
function text(value: unknown, max: number, min = 0) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    throw new Error(`Use ${min}–${max} characters.`);
  return value.normalize("NFKC").trim();
}
function image(value: unknown) {
  if (value == null || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length > 1_500_000 ||
    !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=\r\n]+$/.test(value)
  )
    throw new Error("Use a JPEG photo smaller than 1 MB.");
  return value;
}
function displayName(value: unknown) {
  const name = text(value, 32, 2);
  const error = validateName(name);
  if (error) throw new Error(error);
  if (
    /[\u0000-\u001f\u007f<>]/.test(name) ||
    /^(admin(istrator)?|official[ _]*support|jorata[ _]*staff)$/i.test(name)
  )
    throw new Error("Choose a different temporary name.");
  return name;
}
export function createGuest(s: GuestState, name?: string) {
  const uid = id();
  const profile: Profile = {
    id: uid,
    username: `guest_${uid.slice(0, 8)}`,
    display_name: displayName(name || `Guest_${uid.slice(0, 4)}`),
    bio: "Temporary test identity",
    avatar_path: null,
  };
  s.profiles.push(profile);
  s.members.push({ room_id: "guest-lobby", user_id: uid, role: "member" });
  return profile;
}
function hasRoom(s: GuestState, uid: string, room: Room) {
  return room.kind === "channel"
    ? s.communityMembers.some(
        (m) => m.community_id === room.community_id && m.user_id === uid,
      )
    : s.members.some((m) => m.room_id === room.id && m.user_id === uid);
}
export function snapshot(s: GuestState, uid: string) {
  if (!s.profiles.some((p) => p.id === uid))
    throw new Error("Temporary identity expired. Create a new guest.");
  const rooms = s.rooms.filter((r) => hasRoom(s, uid, r)),
    ids = new Set(rooms.map((r) => r.id));
  const messages = s.messages.filter((m) => ids.has(m.room_id)),
    mids = new Set(messages.map((m) => m.id));
  return {
    profiles: s.profiles,
    rooms,
    members: s.members.filter((m) => ids.has(m.room_id)),
    communities: s.communities,
    communityMembers: s.communityMembers.filter((m) =>
      s.communityMembers.some(
        (me) => me.community_id === m.community_id && me.user_id === uid,
      ),
    ),
    messages,
    reactions: s.reactions.filter((r) => mids.has(r.message_id) && r.active),
    tasks: s.tasks.filter((t) => ids.has(t.room_id) && !t.deleted),
    blocks: s.blocks.filter((b) => b.user_id === uid).map((b) => b.target),
    tiles: s.tiles,
  };
}
export function guestAction(
  s: GuestState,
  uid: string,
  action: string,
  p: Record<string, unknown> = {},
): ActionResult {
  const me = s.profiles.find((u) => u.id === uid);
  if (!me) throw new Error("Unknown temporary identity.");
  const target = () => {
    const u = s.profiles.find((u) => u.id === p.user_id);
    if (!u) throw new Error("Guest not found.");
    return u;
  };
  const room = s.rooms.find((r) => r.id === p.room_id);
  const requireRoom = () => {
    if (!room || !hasRoom(s, uid, room))
      throw new Error("You are not a member of this conversation.");
    return room;
  };
  const role = () =>
    room?.kind === "channel"
      ? s.communityMembers.find(
          (m) => m.community_id === room.community_id && m.user_id === uid,
        )?.role
      : s.members.find((m) => m.room_id === room?.id && m.user_id === uid)
          ?.role;
  const admin = () => {
    requireRoom();
    if (!["owner", "admin"].includes(role() || ""))
      throw new Error("Only owners and admins can do this.");
  };
  const newRoom = (
    kind: Room["kind"],
    name: string,
    community_id: string | null = null,
  ) => {
    const r: Room = {
      id: id(),
      kind,
      name,
      owner_id: uid,
      community_id,
      updated_at: new Date().toISOString(),
    };
    s.rooms.push(r);
    if (kind !== "channel")
      s.members.push({ room_id: r.id, user_id: uid, role: "owner" });
    return r;
  };
  const message = () => {
    requireRoom();
    const m = s.messages.find(
      (m) => m.id === p.message_id && m.room_id === room!.id,
    );
    if (!m || m.deleted) throw new Error("Message unavailable.");
    return m;
  };
  switch (action) {
    case "profile_update":
      me.display_name = displayName(p.display_name);
      me.bio = text(p.bio ?? "", 160);
      if (p.avatar_path !== undefined) me.avatar_path = image(p.avatar_path);
      return {};
    case "open_dm": {
      const other = target();
      if (other.id === uid) throw new Error("Choose another guest.");
      const existing = s.rooms.find(
        (r) =>
          r.kind === "direct" && hasRoom(s, uid, r) && hasRoom(s, other.id, r),
      );
      if (existing) return { id: existing.id };
      const r = newRoom("direct", "");
      s.members.push({ room_id: r.id, user_id: other.id, role: "member" });
      return { id: r.id };
    }
    case "create_group":
      return { id: newRoom("group", text(p.name, 60, 2)).id };
    case "create_community": {
      const c = { id: id(), name: text(p.name, 60, 2), owner_id: uid };
      s.communities.push(c);
      s.communityMembers.push({
        community_id: c.id,
        user_id: uid,
        role: "owner",
      });
      const r = newRoom("channel", "general", c.id);
      return { id: c.id, room_id: r.id };
    }
    case "join_community": {
      const c = s.communities.find((c) => c.id === p.community_id);
      if (!c) throw new Error("Community not found.");
      if (
        !s.communityMembers.some(
          (m) => m.community_id === c.id && m.user_id === uid,
        )
      )
        s.communityMembers.push({
          community_id: c.id,
          user_id: uid,
          role: "member",
        });
      return { room_id: s.rooms.find((r) => r.community_id === c.id)?.id };
    }
    case "create_channel": {
      const cm = s.communityMembers.find(
        (m) => m.community_id === p.community_id && m.user_id === uid,
      );
      if (!cm || cm.role === "member")
        throw new Error("Only community admins can create channels.");
      return {
        id: newRoom("channel", text(p.name, 60, 2), cm.community_id).id,
      };
    }
    case "community_role":
    case "remove_community_member": {
      const c = s.communities.find(
        (c) => c.id === p.community_id && c.owner_id === uid,
      );
      if (!c) throw new Error("Only the community owner can do this.");
      const member = s.communityMembers.find(
        (m) =>
          m.community_id === c.id &&
          m.user_id === p.user_id &&
          m.role !== "owner",
      );
      if (!member) throw new Error("Member unavailable.");
      if (action === "community_role")
        member.role = p.role === "admin" ? "admin" : "member";
      else s.communityMembers = s.communityMembers.filter((m) => m !== member);
      return {};
    }
    case "add_member": {
      admin();
      if (room!.kind !== "group") throw new Error("Choose a group.");
      const u = target();
      if (!hasRoom(s, u.id, room!))
        s.members.push({ room_id: room!.id, user_id: u.id, role: "member" });
      return {};
    }
    case "remove_member": {
      admin();
      const m = s.members.find(
        (m) => m.room_id === room!.id && m.user_id === p.user_id,
      );
      if (!m || m.role === "owner") throw new Error("Cannot remove the owner.");
      s.members = s.members.filter((v) => v !== m);
      return {};
    }
    case "rename_room":
      admin();
      room!.name = text(p.name, 60, 2);
      return {};
    case "leave_room": {
      requireRoom();
      if (role() === "owner")
        throw new Error("The owner must remain in this space.");
      if (room!.kind === "channel")
        s.communityMembers = s.communityMembers.filter(
          (m) => !(m.user_id === uid && m.community_id === room!.community_id),
        );
      else
        s.members = s.members.filter(
          (m) => !(m.user_id === uid && m.room_id === room!.id),
        );
      return {};
    }
    case "send_message": {
      requireRoom();
      if (
        room!.kind === "direct" &&
        s.members.some(
          (m) =>
            m.room_id === room!.id &&
            s.blocks.some(
              (b) =>
                (b.user_id === uid && b.target === m.user_id) ||
                (b.target === uid && b.user_id === m.user_id),
            ),
        )
      )
        throw new Error("Messaging is blocked between these guests.");
      const body = text(p.body ?? "", 4000),
        photo = image(p.attachment_path);
      if (!body && !photo)
        throw new Error("Write a message or attach a photo.");
      const parent = p.reply_to
        ? s.messages.find((m) => m.id === p.reply_to && m.room_id === room!.id)
        : null;
      if (p.reply_to && !parent)
        throw new Error("Reply must be in this conversation.");
      const m: ChatMessage = {
        id: id(),
        room_id: room!.id,
        sender_id: uid,
        body,
        attachment_path: photo,
        reply_to: parent?.id || null,
        deleted: false,
        created_at: new Date().toISOString(),
        edited_at: null,
      };
      s.messages.push(m);
      room!.updated_at = m.created_at;
      return { id: m.id };
    }
    case "edit_message":
    case "delete_message": {
      const m = message();
      if (m.sender_id !== uid)
        throw new Error("You can only change your own messages.");
      if (action === "delete_message") {
        m.deleted = true;
        m.body = "";
        m.attachment_path = null;
      } else {
        m.body = text(p.body, 4000, m.attachment_path ? 0 : 1);
        m.edited_at = new Date().toISOString();
      }
      return {};
    }
    case "react": {
      const m = message(),
        emoji = text(p.emoji, 8, 1);
      if (!["👍", "❤️", "😂", "🎉", "👀", "👋"].includes(emoji))
        throw new Error("Unknown reaction.");
      const r = s.reactions.find(
        (r) => r.message_id === m.id && r.user_id === uid && r.emoji === emoji,
      );
      if (r) r.active = !r.active;
      else
        s.reactions.push({
          message_id: m.id,
          user_id: uid,
          emoji,
          active: true,
        });
      return {};
    }
    case "task_save": {
      requireRoom();
      const existing = p.id
        ? s.tasks.find(
            (t) => t.id === p.id && t.room_id === room!.id && !t.deleted,
          )
        : null;
      if (p.id && !existing) throw new Error("Task unavailable.");
      const title = text(p.title, 160, 1),
        details = text(p.details ?? "", 2000),
        assignee = p.assignee_id ? String(p.assignee_id) : null;
      if (assignee && !hasRoom(s, assignee, room!))
        throw new Error("Assign tasks only to members.");
      const due = p.due_date ? String(p.due_date) : null;
      if (
        due &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(Date.parse(due)))
      )
        throw new Error("Use a valid deadline.");
      const fields = {
        title,
        details,
        assignee_id: assignee,
        due_date: due,
        completed: p.completed === true,
      };
      if (existing) Object.assign(existing, fields);
      else
        s.tasks.push({
          id: id(),
          room_id: room!.id,
          creator_id: uid,
          deleted: false,
          ...fields,
        });
      return {};
    }
    case "task_delete": {
      requireRoom();
      const task = s.tasks.find((t) => t.id === p.id && t.room_id === room!.id);
      if (!task) throw new Error("Task unavailable.");
      if (task.creator_id !== uid) admin();
      task.deleted = true;
      return {};
    }
    case "block":
    case "unblock": {
      const u = target();
      s.blocks = s.blocks.filter(
        (b) => !(b.user_id === uid && b.target === u.id),
      );
      if (action === "block") s.blocks.push({ user_id: uid, target: u.id });
      return {};
    }
    case "report":
      target();
      s.reports.push({
        user_id: uid,
        target: String(p.user_id),
        reason: text(p.reason, 1000, 3),
      });
      return {};
    case "world_edit": {
      const x = Number(p.x),
        y = Number(p.y),
        tile = Number(p.tile);
      if (
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        x >= 96 ||
        y < 0 ||
        y >= 39 ||
        ![0, 4, 6, 7].includes(tile)
      )
        throw new Error("Invalid block.");
      s.tiles[`${x},${y}`] = tile;
      return {};
    }
    default:
      throw new Error("Unknown development action.");
  }
}
