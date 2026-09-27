import type { ConversationDto, Locale } from "@eduprep/core";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { api } from "./api";

const POLL_MS = 20_000;
let unread = 0;
const listeners = new Set<() => void>();

function setUnread(next: number) {
  if (next === unread) return;
  unread = next;
  for (const l of listeners) l();
}

/** Re-count unread messages now (e.g. after opening a chat or sending a message). */
export async function refreshUnread(): Promise<void> {
  try {
    const { conversations } = await api.get<{ conversations: ConversationDto[] }>("/conversations");
    setUnread(conversations.reduce((sum, c) => sum + c.unreadCount, 0));
  } catch {
    // Offline or signed out: keep the last known count.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Total unread messages, polled while the app is in the foreground. */
export function useUnreadMessages(enabled: boolean): number {
  useEffect(() => {
    if (!enabled) return;
    void refreshUnread();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refreshUnread();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled]);
  return useSyncExternalStore(subscribe, () => (enabled ? unread : 0));
}

/** "14:05" today, "Yesterday", or "12 Sept" for older messages. */
export function formatChatTime(iso: string, locale: Locale, yesterdayLabel: string, now = new Date()): string {
  const date = new Date(iso);
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, now)) return new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" }).format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return yesterdayLabel;
  return new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }).format(date);
}
