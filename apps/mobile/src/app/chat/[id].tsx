import type { ConversationDto, MessageDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StateView } from "@/components/ui";
import { VerifiedBadge } from "@/components/verified-badge";
import { api, cacheKey, errorMessage, NetworkError } from "@/lib/api";
import { confirm, notify } from "@/lib/dialog";
import { randomId } from "@/lib/ids";
import { formatChatTime, refreshUnread } from "@/lib/messages";
import { store } from "@/lib/storage";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

const POLL_MS = 4000;

interface PendingMessage {
  clientMessageId: string;
  body: string;
  createdAt: string;
  status: "sending" | "failed";
}

type Row = { type: "server"; message: MessageDto } | { type: "pending"; message: PendingMessage };

function Bubble({
  row,
  showSender,
  onLongPress,
  onRetry,
}: {
  row: Row;
  showSender: boolean;
  onLongPress?: () => void;
  onRetry?: () => void;
}) {
  const c = useColors();
  const { t, locale } = useSession();
  const mine = row.type === "pending" || row.message.mine;
  const body = row.message.body;
  const sender = row.type === "server" ? row.message.sender : null;
  const failed = row.type === "pending" && row.message.status === "failed";
  const meta =
    row.type === "pending"
      ? row.message.status === "sending"
        ? t("sending")
        : t("notSent")
      : formatChatTime(row.message.createdAt, locale, t("yesterday"));

  return (
    <View style={{ alignItems: mine ? "flex-end" : "flex-start", marginVertical: 3 }}>
      {showSender && sender && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3, marginLeft: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: c.muted }}>{sender.displayName}</Text>
          {sender.verified && <VerifiedBadge compact />}
        </View>
      )}
      <Pressable
        onLongPress={onLongPress}
        onPress={failed ? onRetry : undefined}
        delayLongPress={350}
        accessibilityHint={onLongPress ? t("reportMessageTitle") : undefined}
        style={{
          maxWidth: "82%",
          backgroundColor: mine ? c.strong : c.card,
          borderRadius: 20,
          borderBottomRightRadius: mine ? 6 : 20,
          borderBottomLeftRadius: mine ? 20 : 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
          opacity: row.type === "pending" && !failed ? 0.7 : 1,
          borderWidth: failed ? 1.5 : 0,
          borderColor: c.danger,
        }}
      >
        <Text style={{ fontSize: 15.5, lineHeight: 21, color: mine ? c.strongText : c.text }}>{body}</Text>
      </Pressable>
      <Text style={{ fontSize: 11, color: failed ? c.danger : c.faint, marginTop: 3, marginHorizontal: 8 }}>{meta}</Text>
    </View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { t, userId } = useSession();
  const messagesKey = userId && id ? cacheKey(userId, `/conversations/${id}/messages`) : null;
  const [conversation, setConversation] = useState<ConversationDto | null>(() =>
    userId && id ? store.get<ConversationDto>(cacheKey(userId, `/conversations/${id}`)) : null,
  );
  const [messages, setMessages] = useState<MessageDto[]>(() => (messagesKey ? (store.get<MessageDto[]>(messagesKey) ?? []) : []));
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loaded, setLoaded] = useState(messages.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pollTick, setPollTick] = useState(0);
  const lastReadId = useRef<string | null>(null);

  // Poll the conversation and its latest messages while the screen is open.
  useEffect(() => {
    if (!id || !userId) return;
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
          void api.post(`/conversations/${id}/read`).then(refreshUnread, () => undefined);
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
      if (!id) return;
      setPending((list) => list.map((p) => (p.clientMessageId === item.clientMessageId ? { ...p, status: "sending" } : p)));
      try {
        const { message } = await api.post<{ message: MessageDto }>(`/conversations/${id}/messages`, {
          clientMessageId: item.clientMessageId,
          body: item.body,
        });
        setMessages((list) => (list.some((m) => m.id === message.id) ? list : [...list, message]));
        setPending((list) => list.filter((p) => p.clientMessageId !== item.clientMessageId));
        setPollTick((n) => n + 1);
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

  if (!loaded) return <StateView loading />;
  if (error && messages.length === 0) return <StateView error={error} onRetry={() => setPollTick((n) => n + 1)} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["left", "right", "bottom"]}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: c.text }} numberOfLines={1}>
                {title}
              </Text>
              {verified && <VerifiedBadge />}
            </View>
          ),
          headerRight: () =>
            conversation?.peer && !conversation.peer.verified ? (
              <Pressable
                onPress={toggleBlock}
                accessibilityRole="button"
                accessibilityLabel={
                  conversation.blocked ? t("unblockUser", { name: conversation.peer.displayName }) : t("blockUser", { name: conversation.peer.displayName })
                }
                hitSlop={10}
                style={{ paddingHorizontal: 8 }}
              >
                <Ionicons name={conversation.blocked ? "lock-open-outline" : "ban-outline"} size={20} color={c.text} />
              </Pressable>
            ) : null,
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <View style={{ flex: 1, width: "100%", maxWidth: 820, alignSelf: "center" }}>
          <FlatList
            inverted
            data={rows}
            keyExtractor={(row) => (row.type === "server" ? row.message.id : row.message.clientMessageId)}
            contentContainerStyle={{ padding: 16, gap: 2 }}
            ListEmptyComponent={
              <View style={{ transform: [{ scaleY: -1 }], alignItems: "center", padding: 24 }}>
                <Text style={{ color: c.muted, textAlign: "center" }}>{support ? t("supportSubtitle") : t("noMessagesYet")}</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const older = rows[index + 1];
              const senderId = item.type === "server" ? item.message.sender?.id : userId;
              const olderSenderId = older ? (older.type === "server" ? older.message.sender?.id : userId) : undefined;
              const theirs = item.type === "server" && !item.message.mine;
              return (
                <Bubble
                  row={item}
                  showSender={theirs && (support || Boolean(item.message.sender?.verified)) && senderId !== olderSenderId}
                  onLongPress={item.type === "server" && theirs ? () => report(item.message) : undefined}
                  onRetry={item.type === "pending" ? () => deliver(item.message) : undefined}
                />
              );
            }}
          />

          {conversation?.blocked ? (
            <View style={{ margin: 16, padding: 14, borderRadius: 18, backgroundColor: c.tiles.peach.bg, gap: 8 }}>
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
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
              <TextInput
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
                  {
                    flex: 1,
                    minHeight: 48,
                    maxHeight: 130,
                    backgroundColor: c.card,
                    borderRadius: 24,
                    paddingHorizontal: 18,
                    paddingTop: 13,
                    paddingBottom: 13,
                    fontSize: 15.5,
                    color: c.text,
                  },
                  Platform.OS === "web" && ({ outlineStyle: "none" } as object),
                ]}
              />
              <Pressable
                onPress={send}
                disabled={!draft.trim()}
                accessibilityRole="button"
                accessibilityLabel={t("send")}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: draft.trim() ? c.primary : c.track,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Ionicons name="arrow-up" size={22} color={draft.trim() ? c.primaryText : c.faint} />
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
