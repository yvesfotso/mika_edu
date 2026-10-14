import type { ConversationDto, Locale, MessageDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Mascot, nativeDriver, useAnimatedValue, useReducedMotion } from "@/components/mascot/mascot";
import { StateView } from "@/components/ui";
import { VerifiedBadge } from "@/components/verified-badge";
import { api, cacheKey, errorMessage, NetworkError } from "@/lib/api";
import { confirm, notify } from "@/lib/dialog";
import type { MessageKey } from "@/lib/i18n";
import { randomId } from "@/lib/ids";
import { formatChatTime, refreshUnread } from "@/lib/messages";
import { store } from "@/lib/storage";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";
import { ChatAvatar } from "./chat-avatar";

const POLL_MS = 4000;
/** Consecutive messages from the same sender within this window share one bubble group. */
const GROUP_MS = 5 * 60 * 1000;

interface PendingMessage {
  clientMessageId: string;
  body: string;
  createdAt: string;
  status: "sending" | "failed";
}

type Row = { type: "server"; message: MessageDto } | { type: "pending"; message: PendingMessage };

const rowKey = (row: Row) => (row.type === "server" ? row.message.id : row.message.clientMessageId);
const senderKey = (row: Row) => (row.type === "pending" || row.message.mine ? "me" : (row.message.sender?.id ?? "them"));
const dayKey = (iso: string) => new Date(iso).toDateString();

function sameGroup(a: Row, b: Row | undefined) {
  if (!b || senderKey(a) !== senderKey(b)) return false;
  const ta = Date.parse(a.message.createdAt);
  const tb = Date.parse(b.message.createdAt);
  return dayKey(a.message.createdAt) === dayKey(b.message.createdAt) && Math.abs(ta - tb) <= GROUP_MS;
}

function dayLabel(iso: string, locale: Locale, today: string, yesterday: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return today;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return yesterday;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

const SUGGESTIONS: Record<"support" | "direct", MessageKey[]> = {
  support: ["suggestHelp", "suggestExam", "suggestQuiz"],
  direct: ["suggestHello", "suggestStudy"],
};

/** Fades and lifts a bubble in when it arrives after the chat was opened. */
function Arrive({ animate, mine, children }: { animate: boolean; mine: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const live = animate && !reduced;
  const v = useAnimatedValue(live ? 0 : 1);
  useEffect(() => {
    if (live) Animated.spring(v, { toValue: 1, friction: 8, tension: 90, useNativeDriver: nativeDriver }).start();
  }, [live, v]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
        ],
        transformOrigin: mine ? "100% 100%" : "0% 100%",
      }}
    >
      {children}
    </Animated.View>
  );
}

function Bubble({
  row,
  first,
  last,
  showSender,
  showAvatar,
  animate,
  onLongPress,
  onRetry,
}: {
  row: Row;
  first: boolean;
  last: boolean;
  showSender: boolean;
  showAvatar: boolean;
  animate: boolean;
  onLongPress?: () => void;
  onRetry?: () => void;
}) {
  const c = useColors();
  const { t, locale } = useSession();
  const mine = row.type === "pending" || row.message.mine;
  const sender = row.type === "server" ? row.message.sender : null;
  const failed = row.type === "pending" && row.message.status === "failed";
  const sending = row.type === "pending" && row.message.status === "sending";
  const big = 20;
  const tight = 6;

  const bubble = (
    <Pressable
      onLongPress={onLongPress}
      onPress={failed ? onRetry : undefined}
      delayLongPress={350}
      accessibilityHint={onLongPress ? t("reportMessageTitle") : failed ? t("notSent") : undefined}
      style={{
        maxWidth: "100%",
        backgroundColor: mine ? c.primary : c.card,
        borderTopLeftRadius: !mine && !first ? tight : big,
        borderBottomLeftRadius: mine ? big : tight,
        borderTopRightRadius: mine && !first ? tight : big,
        borderBottomRightRadius: mine ? tight : big,
        paddingHorizontal: 14,
        paddingVertical: 9,
        opacity: sending ? 0.75 : 1,
        borderWidth: failed ? 1.5 : 0,
        borderColor: c.danger,
      }}
    >
      <Text style={{ fontSize: 15.5, lineHeight: 21, color: mine ? c.primaryText : c.text }}>{row.message.body}</Text>
    </Pressable>
  );

  return (
    <Arrive animate={animate} mine={mine}>
      <View style={{ marginTop: first ? 10 : 2, alignItems: mine ? "flex-end" : "flex-start" }}>
        {showSender && sender && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4, marginLeft: 40 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: c.muted }}>{sender.displayName}</Text>
            {sender.verified && <VerifiedBadge compact />}
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "84%" }}>
          {!mine && (
            <View style={{ width: 30 }}>
              {showAvatar && last && <ChatAvatar support={!sender || sender.verified} id={sender?.id} name={sender?.displayName ?? "?"} size={30} />}
            </View>
          )}
          <View style={{ flexShrink: 1 }}>{bubble}</View>
        </View>
        {last && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, marginHorizontal: mine ? 4 : 42 }}>
            <Text style={{ fontSize: 11, color: failed ? c.danger : c.faint }}>
              {failed ? t("notSent") : sending ? t("sending") : formatChatTime(row.message.createdAt, locale, t("yesterday"))}
            </Text>
            {mine && !failed && (
              <Ionicons
                name={sending ? "time-outline" : "checkmark-done"}
                size={13}
                color={sending ? c.faint : c.success}
                accessibilityLabel={sending ? t("sending") : t("sent")}
              />
            )}
          </View>
        )}
      </View>
    </Arrive>
  );
}

function DaySeparator({ label }: { label: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", marginTop: 16, marginBottom: 4 }}>
      <View style={{ backgroundColor: c.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ fontSize: 11.5, fontWeight: "600", color: c.muted }}>{label}</Text>
      </View>
    </View>
  );
}

function IconButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: c.background,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={c.text} />
    </Pressable>
  );
}

/**
 * A conversation: header, grouped bubbles with day separators, and the composer. Used full screen on
 * phones (with `onBack`) and inside the two-pane Messages layout on wide screens.
 * `onActivity` fires after messages are sent or read so the conversation list can refresh.
 */
export function ChatView({ conversationId: id, onBack, onActivity }: { conversationId: string; onBack?: () => void; onActivity?: () => void }) {
  const c = useColors();
  const { t, locale, userId } = useSession();
  const messagesKey = userId ? cacheKey(userId, `/conversations/${id}/messages`) : null;
  const [conversation, setConversation] = useState<ConversationDto | null>(() =>
    userId ? store.get<ConversationDto>(cacheKey(userId, `/conversations/${id}`)) : null,
  );
  const [messages, setMessages] = useState<MessageDto[]>(() => (messagesKey ? (store.get<MessageDto[]>(messagesKey) ?? []) : []));
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loaded, setLoaded] = useState(messages.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pollTick, setPollTick] = useState(0);
  // Only messages that arrive after opening the chat animate in.
  const [openedAt] = useState(() => Date.now());
  const lastReadId = useRef<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  // Latest callback without re-running the polling effect when the parent re-renders.
  const activity = useRef(onActivity);
  useEffect(() => {
    activity.current = onActivity;
  });

  // Poll the conversation and its latest messages while the chat is open.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    Promise.all([
      api.get<{ conversation: ConversationDto }>(`/conversations/${id}`),
      api.get<{ messages: MessageDto[] }>(`/conversations/${id}/messages`),
    ]).then(
      ([conv, page]) => {
        if (!active) return;
        setConversation(conv.conversation);
        setMessages(page.messages);
        setLoaded(true);
        setError(null);
        store.set(cacheKey(userId, `/conversations/${id}`), conv.conversation);
        store.set(cacheKey(userId, `/conversations/${id}/messages`), page.messages);
        const newest = page.messages.at(-1);
        if (newest && !newest.mine && newest.id !== lastReadId.current) {
          lastReadId.current = newest.id;
          void api.post(`/conversations/${id}/read`).then(() => {
            void refreshUnread();
            activity.current?.();
          }, () => undefined);
        }
      },
      (err) => {
        if (!active) return;
        setLoaded(true);
        if (!(err instanceof NetworkError)) setError(errorMessage(err, t("offlineNoData")));
      },
    );
    const timer = setTimeout(() => setPollTick((n) => n + 1), POLL_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, userId, pollTick, t]);

  const deliver = useCallback(
    async (item: PendingMessage) => {
      setPending((list) => list.map((p) => (p.clientMessageId === item.clientMessageId ? { ...p, status: "sending" } : p)));
      try {
        const { message } = await api.post<{ message: MessageDto }>(`/conversations/${id}/messages`, {
          clientMessageId: item.clientMessageId,
          body: item.body,
        });
        setMessages((list) => (list.some((m) => m.id === message.id) ? list : [...list, message]));
        setPending((list) => list.filter((p) => p.clientMessageId !== item.clientMessageId));
        setPollTick((n) => n + 1);
        activity.current?.();
      } catch (err) {
        setPending((list) => list.map((p) => (p.clientMessageId === item.clientMessageId ? { ...p, status: "failed" } : p)));
        if (!(err instanceof NetworkError)) notify(errorMessage(err, t("offlineNoData")));
      }
    },
    [id, t],
  );

  function send() {
    const body = draft.trim();
    if (!body) return;
    const item: PendingMessage = { clientMessageId: randomId(), body, createdAt: new Date().toISOString(), status: "sending" };
    setPending((list) => [...list, item]);
    setDraft("");
    void deliver(item);
  }

  async function report(message: MessageDto) {
    const ok = await confirm(t("reportMessageTitle"), `“${message.body.slice(0, 120)}”`, { ok: t("reportConfirm"), cancel: t("cancel") });
    if (!ok) return;
    try {
      await api.post(`/messages/${message.id}/report`, { reason: "" });
      notify(t("reported"));
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    }
  }

  async function toggleBlock() {
    const peer = conversation?.peer;
    if (!peer) return;
    if (!conversation.blocked) {
      const ok = await confirm(t("blockUser", { name: peer.displayName }), t("blockConfirm", { name: peer.displayName }), {
        ok: t("blockUser", { name: peer.displayName }),
        cancel: t("cancel"),
      });
      if (!ok) return;
    }
    try {
      await api.post(`/users/${peer.id}/${conversation.blocked ? "unblock" : "block"}`);
      setPollTick((n) => n + 1);
      activity.current?.();
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    }
  }

  // Newest first for the inverted list.
  const rows = useMemo<Row[]>(() => {
    const sentIds = new Set(messages.map((m) => m.clientMessageId).filter(Boolean));
    const server: Row[] = messages.map((m) => ({ type: "server", message: m }));
    const local: Row[] = pending.filter((p) => !sentIds.has(p.clientMessageId)).map((p) => ({ type: "pending", message: p }));
    return [...server, ...local].reverse();
  }, [messages, pending]);

  const support = conversation?.kind === "support";
  const title = support ? t("supportTeam") : (conversation?.peer?.displayName ?? "");
  const verified = support || Boolean(conversation?.peer?.verified);
  const canDraft = !conversation?.blocked;

  if (!loaded) return <StateView loading />;
  if (error && messages.length === 0) return <StateView error={error} onRetry={() => setPollTick((n) => n + 1)} />;

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: c.card, borderBottomWidth: 1, borderColor: c.border }}>
      {onBack && <IconButton icon="chevron-back" label={t("back")} onPress={onBack} />}
      <ChatAvatar support={support} id={conversation?.peer?.id} name={title || "?"} size={42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: c.text, flexShrink: 1 }} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {verified && <VerifiedBadge compact />}
        </View>
        <Text style={{ fontSize: 12.5, color: c.muted }} numberOfLines={1}>
          {support ? t("supportStatus") : t("studyFriend")}
        </Text>
      </View>
      {conversation?.peer && !conversation.peer.verified && (
        <IconButton
          icon={conversation.blocked ? "lock-open-outline" : "ban-outline"}
          label={conversation.blocked ? t("unblockUser", { name: conversation.peer.displayName }) : t("blockUser", { name: conversation.peer.displayName })}
          onPress={toggleBlock}
        />
      )}
    </View>
  );

  const empty = (
    <View style={{ transform: [{ scaleY: -1 }], alignItems: "center", paddingHorizontal: 24, paddingVertical: 32, gap: 14 }}>
      <Mascot size={130} mood="idle" accessories={support ? ["glasses"] : []} intro />
      <Text style={{ fontSize: 17, fontWeight: "700", color: c.text }}>{t("startConversation")}</Text>
      <Text style={{ color: c.muted, textAlign: "center", maxWidth: 320 }}>{support ? t("supportSubtitle") : t("noMessagesYet")}</Text>
      {canDraft && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 4 }}>
          {SUGGESTIONS[support ? "support" : "direct"].map((key) => (
            <Pressable
              key={key}
              onPress={() => {
                setDraft(t(key));
                inputRef.current?.focus();
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: pressed ? c.primarySoft : c.card,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 8,
              })}
            >
              <Text style={{ fontSize: 13.5, color: c.text, fontWeight: "600" }}>{t(key)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  const hasDraft = draft.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1, width: "100%", maxWidth: 860, alignSelf: "center" }}>
          <FlatList
            inverted
            data={rows}
            keyExtractor={rowKey}
            contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, flexGrow: rows.length ? undefined : 1, justifyContent: "center" }}
            ListEmptyComponent={empty}
            renderItem={({ item, index }) => {
              const newer = rows[index - 1];
              const older = rows[index + 1];
              const theirs = item.type === "server" && !item.message.mine;
              const first = !sameGroup(item, older);
              const newDay = !older || dayKey(older.message.createdAt) !== dayKey(item.message.createdAt);
              return (
                <View>
                  {newDay && <DaySeparator label={dayLabel(item.message.createdAt, locale, t("today"), t("yesterday"))} />}
                  <Bubble
                    row={item}
                    first={first}
                    last={!sameGroup(item, newer)}
                    showSender={theirs && first && (support || Boolean(item.message.sender?.verified))}
                    showAvatar={theirs}
                    animate={item.type === "pending" || Date.parse(item.message.createdAt) > openedAt}
                    onLongPress={item.type === "server" && theirs ? () => report(item.message) : undefined}
                    onRetry={item.type === "pending" ? () => deliver(item.message) : undefined}
                  />
                </View>
              );
            }}
          />

          {conversation?.blocked ? (
            <View style={{ margin: 14, padding: 14, borderRadius: 18, backgroundColor: c.tiles.peach.bg, gap: 8 }}>
              <Text style={{ color: c.tiles.peach.ink, fontWeight: "600" }}>{t("blockedNotice")}</Text>
              {conversation.peer && (
                <Pressable onPress={toggleBlock} accessibilityRole="button">
                  <Text style={{ color: c.text, fontWeight: "700", textDecorationLine: "underline" }}>
                    {t("unblockUser", { name: conversation.peer.displayName })}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: 8,
                  backgroundColor: c.card,
                  borderRadius: 26,
                  borderWidth: 1,
                  borderColor: c.border,
                  paddingLeft: 18,
                  paddingRight: 5,
                  paddingVertical: 5,
                }}
              >
                <TextInput
                  ref={inputRef}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t("typeMessage")}
                  placeholderTextColor={c.faint}
                  multiline
                  maxLength={2000}
                  accessibilityLabel={t("typeMessage")}
                  onKeyPress={(e) => {
                    // Enter sends on the web; Shift+Enter adds a new line.
                    const native = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
                    if (Platform.OS === "web" && native.key === "Enter" && !native.shiftKey) {
                      (e as unknown as { preventDefault: () => void }).preventDefault();
                      send();
                    }
                  }}
                  style={[
                    { flex: 1, minHeight: 40, maxHeight: 130, paddingTop: 10, paddingBottom: 10, fontSize: 15.5, color: c.text },
                    Platform.OS === "web" && ({ outlineStyle: "none" } as object),
                  ]}
                />
                <Pressable
                  onPress={send}
                  disabled={!hasDraft}
                  accessibilityRole="button"
                  accessibilityLabel={t("send")}
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: hasDraft ? c.strong : c.track,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Ionicons name="arrow-up" size={20} color={hasDraft ? c.primary : c.faint} />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
