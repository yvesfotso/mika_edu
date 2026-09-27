/**
 * Demo-mode messaging: the same endpoints and shapes as the real API, stored on this device and
 * shared between local demo accounts. A simulated EduPrep team member (verified) and a study
 * friend reply automatically a few seconds after you write, so the flow can be tested alone.
 */
import {
  directKey,
  isVerifiedRole,
  MESSAGE_RATE_LIMIT,
  randomFriendCode,
  reportMessageSchema,
  sendMessageSchema,
  startDirectSchema,
  type ChatUserDto,
  type ConversationDto,
  type ConversationKind,
  type MessageDto,
  type ProfileDto,
  type UserRole,
} from "@eduprep/core";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "@/lib/errors";
import { randomId } from "@/lib/ids";
import { store } from "@/lib/storage";

interface ChatConversation {
  id: string;
  kind: ConversationKind;
  studentId: string | null;
  directKey: string | null;
  lastMessageAt: string | null;
}
interface ChatMember {
  conversationId: string;
  userId: string;
  lastReadAt: string | null;
}
interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string | null;
  body: string;
  createdAt: string;
}
interface PendingReply {
  conversationId: string;
  senderId: string;
  body: string;
  dueAt: string;
}
interface ChatStore {
  conversations: ChatConversation[];
  members: ChatMember[];
  messages: ChatMessage[];
  blocks: { blockerId: string; blockedId: string }[];
  reports: { messageId: string; reporterId: string; reason: string }[];
  pending: PendingReply[];
  replyCursor: Record<string, number>;
}

const CHAT_KEY = "demo:chat";
const CODES_KEY = "demo:friend-codes";
export const stateKey = (userId: string) => `demo:state:${userId}`;

/** Simulated people who only exist in demo mode. */
export const DEMO_TEAM = { id: "5eed0000-0000-4000-8000-00000000aa01", displayName: "Nadine · EduPrep", role: "admin" as UserRole };
export const DEMO_FRIEND = {
  id: "5eed0000-0000-4000-8000-00000000bb02",
  displayName: "Paul",
  role: "student" as UserRole,
  friendCode: "BAC4ME",
};
const BOTS = [DEMO_TEAM, DEMO_FRIEND];

const REPLY_DELAY_MS = 2500;
const TEAM_REPLIES = {
  en: [
    "Hi {name}! Thanks for your message. I'm Nadine from the EduPrep team. (Demo mode: this reply is automatic; in the live app a teacher answers here.)",
    "Good question! Try the chapter's practice quiz first, then tell me which question type still feels hard.",
    "Noted. We'll add more past-paper questions for your series soon. Keep your daily streak going!",
  ],
  fr: [
    "Bonjour {name} ! Merci pour ton message. Je suis Nadine de l'équipe EduPrep. (Mode démo : cette réponse est automatique ; dans l'application réelle, un enseignant répond ici.)",
    "Bonne question ! Fais d'abord le quiz d'entraînement du chapitre, puis dis-moi quel type de question reste difficile.",
    "C'est noté. Nous ajouterons bientôt d'autres questions d'anciens sujets pour ta série. Continue ta série quotidienne !",
  ],
};
const FRIEND_REPLIES = {
  en: [
    "Nice! Want to revise complex numbers together tonight? 📚",
    "I got 3/4 on the practice quiz. The modulus question tricked me 😅",
    "Send me the question and let's work it out step by step.",
    "Let's both do a timed mock tomorrow and compare scores!",
  ],
  fr: [
    "Cool ! On révise les nombres complexes ensemble ce soir ? 📚",
    "J'ai eu 3/4 au quiz d'entraînement. La question sur le module m'a piégé 😅",
    "Envoie-moi la question et on la résout étape par étape.",
    "On fait tous les deux un examen blanc demain et on compare ?",
  ],
};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function loadChat(): ChatStore {
  return (
    store.get<ChatStore>(CHAT_KEY) ?? { conversations: [], members: [], messages: [], blocks: [], reports: [], pending: [], replyCursor: {} }
  );
}

function saveChat(chat: ChatStore) {
  store.set(CHAT_KEY, chat);
}

function codes(): Record<string, string> {
  return store.get<Record<string, string>>(CODES_KEY) ?? { [DEMO_FRIEND.friendCode]: DEMO_FRIEND.id };
}

/** Assigns a unique friend code to a local demo account (or returns the preferred one if free). */
export function claimFriendCode(userId: string, preferred?: string): string {
  const all = codes();
  const existing = Object.entries(all).find(([, id]) => id === userId)?.[0];
  if (existing) return existing;
  let code = preferred && !all[preferred] ? preferred : randomFriendCode();
  while (all[code]) code = randomFriendCode();
  store.set(CODES_KEY, { ...all, [code]: userId });
  return code;
}

function profileOf(userId: string): { id: string; displayName: string; role: UserRole; locale: "en" | "fr" } | null {
  const bot = BOTS.find((b) => b.id === userId);
  if (bot) return { id: bot.id, displayName: bot.displayName, role: bot.role, locale: "fr" };
  const state = store.get<{ profile: ProfileDto }>(stateKey(userId));
  if (!state) return null;
  return {
    id: userId,
    displayName: state.profile.displayName ?? "—",
    role: state.profile.role,
    locale: state.profile.preferredLanguage,
  };
}

function chatUser(userId: string): ChatUserDto | null {
  const p = profileOf(userId);
  return p ? { id: p.id, displayName: p.displayName, role: p.role, verified: isVerifiedRole(p.role) } : null;
}

function parse<T>(schema: ZodType<T>, body: unknown): T {
  try {
    return schema.parse(body ?? {});
  } catch (err) {
    if (err instanceof ZodError) throw new ApiError(422, "validation_error", err.issues.map((i) => i.message).join("; "));
    throw err;
  }
}

function isBlocked(chat: ChatStore, a: string, b: string): boolean {
  return chat.blocks.some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));
}

function peerOf(conv: ChatConversation, userId: string): string | null {
  if (conv.kind !== "direct" || !conv.directKey) return null;
  const [a, b] = conv.directKey.split(":");
  return a === userId ? (b ?? null) : (a ?? null);
}

function member(chat: ChatStore, conversationId: string, userId: string): ChatMember | undefined {
  return chat.members.find((m) => m.conversationId === conversationId && m.userId === userId);
}

function addMember(chat: ChatStore, conversationId: string, userId: string) {
  if (!member(chat, conversationId, userId)) chat.members.push({ conversationId, userId, lastReadAt: null });
}

function assertMember(chat: ChatStore, userId: string, conversationId: string): ChatConversation {
  const conv = chat.conversations.find((c) => c.id === conversationId);
  if (!conv || !member(chat, conversationId, userId)) throw new ApiError(404, "not_found", "Conversation not found");
  return conv;
}

function post(chat: ChatStore, conversationId: string, senderId: string, body: string, at: Date, clientMessageId: string | null = null): ChatMessage {
  const message = { id: randomId(), conversationId, senderId, clientMessageId, body, createdAt: at.toISOString() };
  chat.messages.push(message);
  const conv = chat.conversations.find((c) => c.id === conversationId);
  if (conv) conv.lastMessageAt = message.createdAt;
  return message;
}

/** Deliver simulated replies whose time has come. */
function deliverDue(chat: ChatStore, now: Date) {
  const due = chat.pending.filter((p) => new Date(p.dueAt) <= now);
  if (due.length === 0) return;
  chat.pending = chat.pending.filter((p) => new Date(p.dueAt) > now);
  for (const p of due) post(chat, p.conversationId, p.senderId, p.body, new Date(p.dueAt));
}

function scheduleBotReply(chat: ChatStore, conv: ChatConversation, userId: string, now: Date) {
  const botId = conv.kind === "support" ? DEMO_TEAM.id : peerOf(conv, userId);
  const bot = BOTS.find((b) => b.id === botId);
  if (!bot || chat.pending.some((p) => p.conversationId === conv.id)) return;
  const user = profileOf(userId);
  const locale = user?.locale ?? "en";
  const pool = (bot.id === DEMO_TEAM.id ? TEAM_REPLIES : FRIEND_REPLIES)[locale];
  const index = chat.replyCursor[conv.id] ?? 0;
  chat.replyCursor[conv.id] = index + 1;
  // The team greets once, then rotates through its other answers; the friend just rotates.
  const pick = bot.id === DEMO_TEAM.id && index > 0 ? 1 + ((index - 1) % (pool.length - 1)) : index % pool.length;
  const body = pool[pick]!.replace("{name}", user?.displayName ?? "");
  chat.pending.push({ conversationId: conv.id, senderId: bot.id, body, dueAt: new Date(now.getTime() + REPLY_DELAY_MS).toISOString() });
}

function toMessage(m: ChatMessage, viewerId: string): MessageDto {
  return {
    id: m.id,
    conversationId: m.conversationId,
    sender: chatUser(m.senderId),
    mine: m.senderId === viewerId,
    body: m.body,
    createdAt: m.createdAt,
    clientMessageId: m.clientMessageId,
  };
}

function toConversation(chat: ChatStore, conv: ChatConversation, userId: string): ConversationDto {
  const messages = chat.messages.filter((m) => m.conversationId === conv.id);
  const last = messages.at(-1);
  const readAt = member(chat, conv.id, userId)?.lastReadAt;
  const peerId = peerOf(conv, userId);
  return {
    id: conv.id,
    kind: conv.kind,
    peer: peerId ? chatUser(peerId) : null,
    lastMessage: last ? { body: last.body, createdAt: last.createdAt, mine: last.senderId === userId } : null,
    unreadCount: messages.filter((m) => m.senderId !== userId && (!readAt || m.createdAt > readAt)).length,
    blocked: peerId ? isBlocked(chat, userId, peerId) : false,
  };
}

function findOrCreateSupport(chat: ChatStore, userId: string): ChatConversation {
  let conv = chat.conversations.find((c) => c.kind === "support" && c.studentId === userId);
  if (!conv) {
    conv = { id: randomId(), kind: "support", studentId: userId, directKey: null, lastMessageAt: null };
    chat.conversations.push(conv);
  }
  addMember(chat, conv.id, userId);
  return conv;
}

function findOrCreateDirect(chat: ChatStore, userId: string, otherId: string): ChatConversation {
  const key = directKey(userId, otherId);
  let conv = chat.conversations.find((c) => c.directKey === key);
  if (!conv) {
    conv = { id: randomId(), kind: "direct", studentId: null, directKey: key, lastMessageAt: null };
    chat.conversations.push(conv);
  }
  addMember(chat, conv.id, userId);
  addMember(chat, conv.id, otherId);
  return conv;
}

/** Gives the demo account a welcome message from the team and a message from its study friend. */
export function seedDemoConversations(userId: string, now: Date) {
  const chat = loadChat();
  if (chat.conversations.some((c) => c.studentId === userId)) return;
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

  const support = findOrCreateSupport(chat, userId);
  post(
    chat,
    support.id,
    DEMO_TEAM.id,
    "Bienvenue sur EduPrep, Amina ! 👋 Écris-nous ici si tu as une question sur une leçon, un exercice ou ton examen. Un membre vérifié de l'équipe te répondra.",
    ago(48),
  );
  const supportMember = member(chat, support.id, userId);
  if (supportMember) supportMember.lastReadAt = ago(40).toISOString();

  const direct = findOrCreateDirect(chat, userId, DEMO_FRIEND.id);
  post(chat, direct.id, userId, "Salut Paul ! On révise ensemble cette semaine ?", ago(26), null);
  post(chat, direct.id, DEMO_FRIEND.id, "Oui ! Tu as fini le chapitre sur les nombres complexes ?", ago(20));
  const directMember = member(chat, direct.id, userId);
  if (directMember) directMember.lastReadAt = ago(25).toISOString();

  saveChat(chat);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

type Ctx = { userId: string; params: string[]; body: unknown; now: Date; url: URL };
type Handler = (ctx: Ctx, chat: ChatStore) => unknown;

export const messagingRoutes: [method: string, pattern: RegExp, handler: Handler][] = [
  [
    "GET",
    /^\/conversations$/,
    ({ userId }, chat) => ({
      conversations: chat.conversations
        .filter((c) => member(chat, c.id, userId))
        .map((c) => toConversation(chat, c, userId))
        .sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === "support" ? -1 : 1;
          return (b.lastMessage?.createdAt ?? "").localeCompare(a.lastMessage?.createdAt ?? "");
        }),
    }),
  ],
  ["POST", /^\/conversations\/support$/, ({ userId }, chat) => ({ conversationId: findOrCreateSupport(chat, userId).id })],
  [
    "POST",
    /^\/conversations\/direct$/,
    ({ userId, body }, chat) => {
      const { friendCode } = parse(startDirectSchema, body);
      const otherId = codes()[friendCode];
      if (!otherId || !profileOf(otherId)) throw new ApiError(404, "unknown_code", "No learner uses this friend code");
      if (otherId === userId) throw new ApiError(422, "own_code", "That's your own friend code");
      if (isBlocked(chat, userId, otherId)) throw new ApiError(403, "blocked", "You can't message this person");
      return { conversationId: findOrCreateDirect(chat, userId, otherId).id };
    },
  ],
  [
    "GET",
    /^\/conversations\/([^/]+)$/,
    ({ userId, params }, chat) => ({ conversation: toConversation(chat, assertMember(chat, userId, params[0]!), userId) }),
  ],
  [
    "GET",
    /^\/conversations\/([^/]+)\/messages$/,
    ({ userId, params, url }, chat) => {
      assertMember(chat, userId, params[0]!);
      const before = url.searchParams.get("before");
      const all = chat.messages.filter((m) => m.conversationId === params[0] && (!before || m.createdAt < before));
      const page = all.slice(-50);
      return { messages: page.map((m) => toMessage(m, userId)), hasMore: all.length > page.length };
    },
  ],
  [
    "POST",
    /^\/conversations\/([^/]+)\/messages$/,
    ({ userId, params, body, now }, chat) => {
      const conv = assertMember(chat, userId, params[0]!);
      const input = parse(sendMessageSchema, body);
      const peerId = peerOf(conv, userId);
      if (peerId && isBlocked(chat, userId, peerId)) throw new ApiError(403, "blocked", "You can't message this person");
      const existing = chat.messages.find((m) => m.senderId === userId && m.clientMessageId === input.clientMessageId);
      if (existing) return { message: toMessage(existing, userId) };
      const since = new Date(now.getTime() - MESSAGE_RATE_LIMIT.windowMs).toISOString();
      if (chat.messages.filter((m) => m.senderId === userId && m.createdAt >= since).length >= MESSAGE_RATE_LIMIT.count) {
        throw new ApiError(429, "rate_limited", "You're sending messages too quickly. Please wait a moment.");
      }
      const message = post(chat, conv.id, userId, input.body, now, input.clientMessageId);
      const me = member(chat, conv.id, userId);
      if (me) me.lastReadAt = now.toISOString();
      scheduleBotReply(chat, conv, userId, now);
      return { message: toMessage(message, userId) };
    },
  ],
  [
    "POST",
    /^\/conversations\/([^/]+)\/read$/,
    ({ userId, params, now }, chat) => {
      assertMember(chat, userId, params[0]!);
      const me = member(chat, params[0]!, userId)!;
      me.lastReadAt = now.toISOString();
      return { ok: true };
    },
  ],
  [
    "POST",
    /^\/users\/([^/]+)\/block$/,
    ({ userId, params }, chat) => {
      const target = profileOf(params[0]!);
      if (!target) throw new ApiError(404, "not_found", "User not found");
      if (target.id === userId) throw new ApiError(422, "self", "You can't block yourself");
      if (isVerifiedRole(target.role)) throw new ApiError(422, "staff", "The EduPrep team can't be blocked. Report a message instead.");
      if (!chat.blocks.some((b) => b.blockerId === userId && b.blockedId === target.id)) chat.blocks.push({ blockerId: userId, blockedId: target.id });
      chat.pending = chat.pending.filter((p) => p.senderId !== target.id);
      return { ok: true };
    },
  ],
  [
    "POST",
    /^\/users\/([^/]+)\/unblock$/,
    ({ userId, params }, chat) => {
      chat.blocks = chat.blocks.filter((b) => !(b.blockerId === userId && b.blockedId === params[0]));
      return { ok: true };
    },
  ],
  [
    "POST",
    /^\/messages\/([^/]+)\/report$/,
    ({ userId, params, body }, chat) => {
      const message = chat.messages.find((m) => m.id === params[0]);
      if (!message) throw new ApiError(404, "not_found", "Message not found");
      assertMember(chat, userId, message.conversationId);
      if (message.senderId === userId) throw new ApiError(422, "own_message", "You can't report your own message");
      const { reason } = parse(reportMessageSchema, body);
      if (!chat.reports.some((r) => r.messageId === message.id && r.reporterId === userId)) {
        chat.reports.push({ messageId: message.id, reporterId: userId, reason });
      }
      return { ok: true };
    },
  ],
];

/** Runs a messaging route if one matches; returns undefined otherwise. */
export function handleMessaging(method: string, path: string, userId: string, body: unknown, now: Date): { result: unknown } | undefined {
  const url = new URL(path, "http://demo.local");
  for (const [m, pattern, handler] of messagingRoutes) {
    const match = m === method ? pattern.exec(url.pathname) : null;
    if (!match) continue;
    const chat = loadChat();
    deliverDue(chat, now);
    const result = handler({ userId, params: match.slice(1), body, now, url }, chat);
    saveChat(chat);
    return { result };
  }
  return undefined;
}
