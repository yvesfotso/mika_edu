import "server-only";
import {
  directKey,
  isVerifiedRole,
  MESSAGE_RATE_LIMIT,
  type ChatUserDto,
  type ConversationDto,
  type ConversationKind,
  type MessageDto,
  type SendMessageInput,
  type UserRole,
} from "@eduprep/core";
import { ApiError, must, notFound, type Db } from "../db";

interface ProfileLite {
  id: string;
  display_name: string | null;
  role: UserRole;
}
interface ConversationRow {
  id: string;
  kind: ConversationKind;
  student_id: string | null;
  direct_key: string | null;
  last_message_at: string | null;
  staff_last_read_at: string | null;
}
interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  client_message_id: string | null;
  body: string;
  created_at: string;
}

const MESSAGE_COLUMNS = "id, conversation_id, sender_id, client_message_id, body, created_at";
const PAGE_SIZE = 50;

export function toChatUser(p: ProfileLite): ChatUserDto {
  return { id: p.id, displayName: p.display_name?.trim() || "—", role: p.role, verified: isVerifiedRole(p.role) };
}

async function loadProfiles(db: Db, ids: (string | null)[]): Promise<Map<string, ProfileLite>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const rows = must(await db.from("profiles").select("id, display_name, role").in("id", unique), "loading profiles") as ProfileLite[];
  return new Map(rows.map((p) => [p.id, p]));
}

function toMessageDto(m: MessageRow, viewerId: string | null, senders: Map<string, ProfileLite>): MessageDto {
  const sender = m.sender_id ? senders.get(m.sender_id) : undefined;
  return {
    id: m.id,
    conversationId: m.conversation_id,
    sender: sender ? toChatUser(sender) : null,
    mine: viewerId !== null && m.sender_id === viewerId,
    body: m.body,
    createdAt: m.created_at,
    clientMessageId: m.client_message_id,
  };
}

async function isBlockedBetween(db: Db, a: string, b: string): Promise<boolean> {
  const rows = must(
    await db
      .from("user_blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
      .limit(1),
    "checking blocks",
  ) as unknown[];
  return rows.length > 0;
}

async function loadConversation(db: Db, id: string): Promise<ConversationRow> {
  const row = must(
    await db
      .from("conversations")
      .select("id, kind, student_id, direct_key, last_message_at, staff_last_read_at")
      .eq("id", id)
      .maybeSingle<ConversationRow>(),
    "loading conversation",
  );
  if (!row) throw notFound("Conversation");
  return row;
}

async function assertMember(db: Db, userId: string, conversationId: string): Promise<ConversationRow> {
  const member = must(
    await db.from("conversation_members").select("user_id").eq("conversation_id", conversationId).eq("user_id", userId).maybeSingle(),
    "checking membership",
  );
  if (!member) throw notFound("Conversation");
  return loadConversation(db, conversationId);
}

function otherUserId(conv: ConversationRow, userId: string): string | null {
  if (conv.kind !== "direct" || !conv.direct_key) return null;
  const [a, b] = conv.direct_key.split(":");
  return a === userId ? (b ?? null) : (a ?? null);
}

// ---------------------------------------------------------------------------
// Learner-facing
// ---------------------------------------------------------------------------

export async function listConversations(db: Db, userId: string): Promise<ConversationDto[]> {
  const memberships = must(
    await db.from("conversation_members").select("conversation_id, last_read_at").eq("user_id", userId),
    "loading memberships",
  ) as { conversation_id: string; last_read_at: string | null }[];
  if (memberships.length === 0) return [];
  const ids = memberships.map((m) => m.conversation_id);

  const convs = must(
    await db.from("conversations").select("id, kind, student_id, direct_key, last_message_at, staff_last_read_at").in("id", ids),
    "loading conversations",
  ) as ConversationRow[];
  const peers = await loadProfiles(db, convs.map((c) => otherUserId(c, userId)));
  const lastRead = new Map(memberships.map((m) => [m.conversation_id, m.last_read_at]));

  const result = await Promise.all(
    convs.map(async (conv): Promise<ConversationDto> => {
      const peerId = otherUserId(conv, userId);
      const readAt = lastRead.get(conv.id);
      let unread = db.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).neq("sender_id", userId);
      if (readAt) unread = unread.gt("created_at", readAt);
      const [last, unreadRes, blocked] = await Promise.all([
        db.from("messages").select(MESSAGE_COLUMNS).eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(1).maybeSingle<MessageRow>(),
        unread,
        peerId ? isBlockedBetween(db, userId, peerId) : Promise.resolve(false),
      ]);
      const lastMessage = must(last, "loading last message");
      const peer = peerId ? peers.get(peerId) : undefined;
      return {
        id: conv.id,
        kind: conv.kind,
        peer: peer ? toChatUser(peer) : null,
        lastMessage: lastMessage ? { body: lastMessage.body, createdAt: lastMessage.created_at, mine: lastMessage.sender_id === userId } : null,
        unreadCount: unreadRes.count ?? 0,
        blocked,
      };
    }),
  );

  // Support first, then most recent activity.
  return result.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "support" ? -1 : 1;
    return (b.lastMessage?.createdAt ?? "").localeCompare(a.lastMessage?.createdAt ?? "");
  });
}

async function addMember(db: Db, conversationId: string, userId: string) {
  must(
    await db.from("conversation_members").upsert({ conversation_id: conversationId, user_id: userId }, { onConflict: "conversation_id,user_id", ignoreDuplicates: true }),
    "adding member",
  );
}

export async function openSupportConversation(db: Db, userId: string): Promise<{ id: string }> {
  const find = async () =>
    must(
      await db.from("conversations").select("id").eq("kind", "support").eq("student_id", userId).maybeSingle<{ id: string }>(),
      "loading support conversation",
    );
  let conv = await find();
  if (!conv) {
    const created = await db.from("conversations").insert({ kind: "support", student_id: userId }).select("id").single<{ id: string }>();
    conv = created.error?.code === "23505" ? await find() : must(created, "creating support conversation");
  }
  if (!conv) throw new ApiError(500, "db_error", "Could not open the support conversation");
  await addMember(db, conv.id, userId);
  return conv;
}

export async function openDirectConversation(db: Db, userId: string, friendCode: string): Promise<{ id: string }> {
  const friend = must(
    await db.from("profiles").select("id, display_name, role").eq("friend_code", friendCode).maybeSingle<ProfileLite>(),
    "looking up friend code",
  );
  if (!friend) throw new ApiError(404, "unknown_code", "No learner uses this friend code");
  if (friend.id === userId) throw new ApiError(422, "own_code", "That's your own friend code");
  if (await isBlockedBetween(db, userId, friend.id)) throw new ApiError(403, "blocked", "You can't message this person");

  const key = directKey(userId, friend.id);
  const find = async () =>
    must(await db.from("conversations").select("id").eq("direct_key", key).maybeSingle<{ id: string }>(), "loading conversation");
  let conv = await find();
  if (!conv) {
    const created = await db.from("conversations").insert({ kind: "direct", direct_key: key }).select("id").single<{ id: string }>();
    conv = created.error?.code === "23505" ? await find() : must(created, "creating conversation");
  }
  if (!conv) throw new ApiError(500, "db_error", "Could not open the conversation");
  await addMember(db, conv.id, userId);
  await addMember(db, conv.id, friend.id);
  return conv;
}

export async function getConversation(db: Db, userId: string, conversationId: string): Promise<ConversationDto> {
  await assertMember(db, userId, conversationId);
  const all = await listConversations(db, userId);
  const conv = all.find((c) => c.id === conversationId);
  if (!conv) throw notFound("Conversation");
  return conv;
}

/** Newest page of messages (oldest first), or the page before `before` (an ISO timestamp). */
export async function listMessages(
  db: Db,
  viewerId: string | null,
  conversationId: string,
  before?: string,
): Promise<{ messages: MessageDto[]; hasMore: boolean }> {
  let query = db
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (before) query = query.lt("created_at", before);
  const rows = must(await query, "loading messages") as MessageRow[];
  const page = rows.slice(0, PAGE_SIZE).reverse();
  const senders = await loadProfiles(db, page.map((m) => m.sender_id));
  return { messages: page.map((m) => toMessageDto(m, viewerId, senders)), hasMore: rows.length > PAGE_SIZE };
}

export async function listMessagesForMember(db: Db, userId: string, conversationId: string, before?: string) {
  await assertMember(db, userId, conversationId);
  return listMessages(db, userId, conversationId, before);
}

async function insertMessage(db: Db, senderId: string, conv: ConversationRow, input: SendMessageInput, now: Date): Promise<MessageDto> {
  const since = new Date(now.getTime() - MESSAGE_RATE_LIMIT.windowMs).toISOString();
  const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", senderId).gte("created_at", since);
  if ((count ?? 0) >= MESSAGE_RATE_LIMIT.count) {
    throw new ApiError(429, "rate_limited", "You're sending messages too quickly. Please wait a moment.");
  }

  const inserted = await db
    .from("messages")
    .insert({ conversation_id: conv.id, sender_id: senderId, client_message_id: input.clientMessageId, body: input.body, created_at: now.toISOString() })
    .select(MESSAGE_COLUMNS)
    .single<MessageRow>();

  let row: MessageRow;
  if (inserted.error?.code === "23505") {
    // A retry of a message that already went through.
    row = must(
      await db.from("messages").select(MESSAGE_COLUMNS).eq("sender_id", senderId).eq("client_message_id", input.clientMessageId).single<MessageRow>(),
      "loading existing message",
    );
  } else {
    row = must(inserted, "sending message");
    must(await db.from("conversations").update({ last_message_at: row.created_at }).eq("id", conv.id), "updating conversation");
  }
  const senders = await loadProfiles(db, [senderId]);
  return toMessageDto(row, senderId, senders);
}

export async function sendMessage(db: Db, userId: string, conversationId: string, input: SendMessageInput, now: Date): Promise<MessageDto> {
  const conv = await assertMember(db, userId, conversationId);
  const peerId = otherUserId(conv, userId);
  if (peerId && (await isBlockedBetween(db, userId, peerId))) {
    throw new ApiError(403, "blocked", "You can't message this person");
  }
  const message = await insertMessage(db, userId, conv, input, now);
  await markRead(db, userId, conversationId, now);
  return message;
}

export async function markRead(db: Db, userId: string, conversationId: string, now: Date): Promise<void> {
  must(
    await db.from("conversation_members").update({ last_read_at: now.toISOString() }).eq("conversation_id", conversationId).eq("user_id", userId),
    "marking conversation read",
  );
}

export async function blockUser(db: Db, userId: string, targetId: string): Promise<void> {
  if (targetId === userId) throw new ApiError(422, "self", "You can't block yourself");
  const target = must(await db.from("profiles").select("id, role").eq("id", targetId).maybeSingle<{ id: string; role: UserRole }>(), "loading user");
  if (!target) throw notFound("User");
  if (isVerifiedRole(target.role)) throw new ApiError(422, "staff", "The EduPrep team can't be blocked. Report a message instead.");
  must(
    await db.from("user_blocks").upsert({ blocker_id: userId, blocked_id: targetId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true }),
    "blocking user",
  );
}

export async function unblockUser(db: Db, userId: string, targetId: string): Promise<void> {
  must(await db.from("user_blocks").delete().eq("blocker_id", userId).eq("blocked_id", targetId), "unblocking user");
}

export async function reportMessage(db: Db, userId: string, messageId: string, reason: string): Promise<void> {
  const message = must(
    await db.from("messages").select("conversation_id, sender_id").eq("id", messageId).maybeSingle<{ conversation_id: string; sender_id: string | null }>(),
    "loading message",
  );
  if (!message) throw notFound("Message");
  await assertMember(db, userId, message.conversation_id);
  if (message.sender_id === userId) throw new ApiError(422, "own_message", "You can't report your own message");
  must(
    await db
      .from("message_reports")
      .upsert({ message_id: messageId, reporter_id: userId, reason }, { onConflict: "message_id,reporter_id", ignoreDuplicates: true }),
    "reporting message",
  );
}

// ---------------------------------------------------------------------------
// Staff-facing (admin inbox)
// ---------------------------------------------------------------------------

export interface SupportThreadSummary {
  id: string;
  student: ChatUserDto | null;
  lastMessage: { body: string; createdAt: string; fromStudent: boolean } | null;
  unreadForStaff: number;
}

export async function listSupportInbox(db: Db): Promise<SupportThreadSummary[]> {
  const convs = must(
    await db
      .from("conversations")
      .select("id, kind, student_id, direct_key, last_message_at, staff_last_read_at")
      .eq("kind", "support")
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false })
      .limit(100),
    "loading support inbox",
  ) as ConversationRow[];
  const students = await loadProfiles(db, convs.map((c) => c.student_id));

  return Promise.all(
    convs.map(async (conv) => {
      let unread = db.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("sender_id", conv.student_id!);
      if (conv.staff_last_read_at) unread = unread.gt("created_at", conv.staff_last_read_at);
      const [last, unreadRes] = await Promise.all([
        db.from("messages").select(MESSAGE_COLUMNS).eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(1).maybeSingle<MessageRow>(),
        unread,
      ]);
      const lastMessage = must(last, "loading last message");
      const student = conv.student_id ? students.get(conv.student_id) : undefined;
      return {
        id: conv.id,
        student: student ? toChatUser(student) : null,
        lastMessage: lastMessage ? { body: lastMessage.body, createdAt: lastMessage.created_at, fromStudent: lastMessage.sender_id === conv.student_id } : null,
        unreadForStaff: unreadRes.count ?? 0,
      };
    }),
  );
}

export async function loadSupportThread(db: Db, staffId: string, conversationId: string, now: Date) {
  const conv = await loadConversation(db, conversationId);
  if (conv.kind !== "support") throw notFound("Conversation");
  const [students, page] = await Promise.all([loadProfiles(db, [conv.student_id]), listMessages(db, staffId, conversationId)]);
  must(await db.from("conversations").update({ staff_last_read_at: now.toISOString() }).eq("id", conv.id), "marking thread read");
  const student = conv.student_id ? students.get(conv.student_id) : undefined;
  return { id: conv.id, student: student ? toChatUser(student) : null, ...page };
}

export async function sendStaffReply(db: Db, staffId: string, conversationId: string, input: SendMessageInput, now: Date) {
  const conv = await loadConversation(db, conversationId);
  if (conv.kind !== "support") throw new ApiError(403, "forbidden", "Staff can only reply in support conversations");
  const message = await insertMessage(db, staffId, conv, input, now);
  must(await db.from("conversations").update({ staff_last_read_at: now.toISOString() }).eq("id", conv.id), "marking thread read");
  return message;
}

export async function listOpenReports(db: Db) {
  const reports = must(
    await db
      .from("message_reports")
      .select("id, reason, created_at, reporter_id, messages(id, body, sender_id, conversation_id)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100),
    "loading reports",
  ) as unknown as {
    id: number;
    reason: string;
    created_at: string;
    reporter_id: string;
    messages: { id: string; body: string; sender_id: string | null; conversation_id: string } | null;
  }[];
  const people = await loadProfiles(db, reports.flatMap((r) => [r.reporter_id, r.messages?.sender_id ?? null]));
  return reports.map((r) => ({
    id: r.id,
    reason: r.reason,
    createdAt: r.created_at,
    reporter: people.get(r.reporter_id)?.display_name ?? "—",
    sender: r.messages?.sender_id ? (people.get(r.messages.sender_id)?.display_name ?? "—") : "—",
    body: r.messages?.body ?? "",
  }));
}
