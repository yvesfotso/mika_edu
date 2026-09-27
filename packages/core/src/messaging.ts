import { z } from "zod";
import type { UserRole } from "./types";

/** Friend codes avoid look-alike characters (0/O, 1/I/L) so they can be read aloud or copied by hand. */
export const FRIEND_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const FRIEND_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export const MESSAGE_MAX_LENGTH = 2000;
/** At most this many messages per user per minute. */
export const MESSAGE_RATE_LIMIT = { count: 20, windowMs: 60_000 };

export type ConversationKind = "support" | "direct";

export interface ChatUserDto {
  id: string;
  displayName: string;
  role: UserRole;
  /** Staff accounts (admins, reviewers, teachers) carry a verified badge. */
  verified: boolean;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  sender: ChatUserDto | null;
  mine: boolean;
  body: string;
  createdAt: string;
  clientMessageId: string | null;
}

export interface ConversationDto {
  id: string;
  kind: ConversationKind;
  /** The other learner in a direct chat; null for the support conversation. */
  peer: ChatUserDto | null;
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
  unreadCount: number;
  /** True when either side has blocked the other (direct chats only). */
  blocked: boolean;
}

export function isVerifiedRole(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "reviewer" || role === "teacher";
}

export function randomFriendCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += FRIEND_CODE_ALPHABET[Math.floor(random() * FRIEND_CODE_ALPHABET.length)];
  return code;
}

/** Stable key for a direct conversation between two users, independent of who started it. */
export function directKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export const friendCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/[\s-]/g, ""))
  .pipe(z.string().regex(FRIEND_CODE_PATTERN, "Friend codes have 6 letters and digits"));

export const startDirectSchema = z.object({ friendCode: friendCodeSchema });

export const sendMessageSchema = z.object({
  clientMessageId: z.uuid(),
  body: z.string().trim().min(1, "Message is empty").max(MESSAGE_MAX_LENGTH),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const reportMessageSchema = z.object({
  reason: z.string().trim().max(500).default(""),
});
