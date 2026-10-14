import type { ConversationDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Share, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatView } from "@/components/chat/chat-view";
import { Mascot } from "@/components/mascot/mascot";
import { PillInput } from "@/components/text-field";
import { Button, OfflineNotice, StateView, T } from "@/components/ui";
import { VerifiedBadge } from "@/components/verified-badge";
import { DEMO_FRIEND } from "@/demo/messaging";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";
import { isDemo } from "@/lib/config";
import { notify } from "@/lib/dialog";
import { formatChatTime, refreshUnread } from "@/lib/messages";
import { SIDEBAR_BREAKPOINT, useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

const SUPPORT_PLACEHOLDER: ConversationDto = { id: "support", kind: "support", peer: null, lastMessage: null, unreadCount: 0, blocked: false };

function ConversationRow({
  conversation,
  selected,
  pinned,
  onPress,
}: {
  conversation: ConversationDto;
  selected: boolean;
  pinned: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const { t, locale } = useSession();
  const support = conversation.kind === "support";
  const name = support ? t("supportTeam") : (conversation.peer?.displayName ?? "—");
  const unread = conversation.unreadCount > 0;
  const preview = conversation.blocked
    ? t("blockedNotice")
    : conversation.lastMessage
      ? `${conversation.lastMessage.mine ? `${t("you")}: ` : ""}${conversation.lastMessage.body}`
      : support
        ? t("supportSubtitle")
        : t("noMessagesYet");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={unread ? `${name}, ${conversation.unreadCount} ${t("filterUnread").toLowerCase()}` : name}
      accessibilityState={{ selected }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 11,
        borderRadius: 18,
        backgroundColor: selected ? c.primarySoft : pressed || hovered ? c.background : "transparent",
      })}
    >
      <View>
        <ChatAvatar support={support} id={conversation.peer?.id} name={name} size={48} />
        {unread && (
          <View
            style={{ position: "absolute", right: -1, top: -1, width: 14, height: 14, borderRadius: 7, backgroundColor: c.primary, borderWidth: 2.5, borderColor: c.card }}
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: unread ? "800" : "700", color: c.text, flexShrink: 1 }} numberOfLines={1}>
            {name}
          </Text>
          {(support || conversation.peer?.verified) && <VerifiedBadge compact />}
          <View style={{ flex: 1 }} />
          {conversation.lastMessage ? (
            <Text style={{ fontSize: 11.5, color: unread ? c.text : c.muted, fontWeight: unread ? "700" : "400" }}>
              {formatChatTime(conversation.lastMessage.createdAt, locale, t("yesterday"))}
            </Text>
          ) : (
            pinned && <Ionicons name="pin" size={13} color={c.faint} accessibilityLabel={t("pinned")} />
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 13, color: unread ? c.text : c.muted, fontWeight: unread ? "600" : "400" }} numberOfLines={1}>
            {preview}
          </Text>
          {unread && (
            <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: c.strong, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: c.primary }}>{conversation.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function FilterChip({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: active ? c.strong : c.background,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "700", color: active ? c.strongText : c.text }}>{label}</Text>
      {count ? (
        <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 10.5, fontWeight: "800", color: c.primaryText }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function Messages() {
  const c = useColors();
  const { t, profile } = useSession();
  const { width } = useWindowDimensions();
  const wide = width >= SIDEBAR_BREAKPOINT;
  const { data, error, loading, offline, refresh } = useApi<{ conversations: ConversationDto[] }>("/conversations");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const friendCode = profile?.friendCode ?? "";

  // Phones open chats full screen; wide screens show them in the right-hand pane.
  function open(id: string) {
    if (wide) setSelected(id);
    else router.push(`/chat/${id}`);
    void refreshUnread();
  }

  async function openSupport() {
    setBusy("support");
    try {
      const { conversationId } = await api.post<{ conversationId: string }>("/conversations/support");
      void refresh();
      open(conversationId);
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setBusy(null);
    }
  }

  async function addFriend() {
    if (!code.trim()) return;
    setBusy("friend");
    setCodeError(null);
    try {
      const { conversationId } = await api.post<{ conversationId: string }>("/conversations/direct", { friendCode: code });
      setCode("");
      setShowNew(false);
      void refresh();
      open(conversationId);
    } catch (err) {
      setCodeError(errorMessage(err, t("offlineNoData")));
    } finally {
      setBusy(null);
    }
  }

  async function copyCode() {
    await Clipboard.setStringAsync(friendCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function shareCode() {
    const message = t("shareMessage", { code: friendCode });
    try {
      if (Platform.OS === "web" && !("share" in navigator)) {
        await copyCode();
        return;
      }
      await Share.share({ message });
    } catch {
      // Share sheet dismissed.
    }
  }

  if (!data) return <StateView loading={loading || !error} error={error} onRetry={refresh} />;

  // The EduPrep team is pinned on top, even before the learner has written to it.
  const support = data.conversations.find((conv) => conv.kind === "support") ?? SUPPORT_PLACEHOLDER;
  const others = data.conversations.filter((conv) => conv.kind !== "support");
  const unreadTotal = data.conversations.reduce((n, conv) => n + conv.unreadCount, 0);
  const q = query.trim().toLowerCase();
  const matches = (conv: ConversationDto) => {
    if (filter === "unread" && conv.unreadCount === 0) return false;
    if (!q) return true;
    const name = conv.kind === "support" ? t("supportTeam") : (conv.peer?.displayName ?? "");
    return name.toLowerCase().includes(q) || (conv.lastMessage?.body.toLowerCase().includes(q) ?? false);
  };
  const visible = [support, ...others].filter(matches);
  const pressRow = (conv: ConversationDto) => (conv.id === SUPPORT_PLACEHOLDER.id ? openSupport() : open(conv.id));

  const newChatPanel = showNew && (
    <View style={{ gap: 12 }}>
      <View style={{ backgroundColor: c.strong, borderRadius: 20, padding: 16, gap: 10, overflow: "hidden" }}>
        <View style={{ position: "absolute", right: -30, top: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: c.strongRaised }} />
        <Text style={{ color: c.strongMuted, fontSize: 12.5 }}>{t("yourFriendCode")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text
            style={{ flex: 1, color: c.primary, fontSize: 26, fontWeight: "800", letterSpacing: 3 }}
            selectable
            accessibilityLabel={friendCode.split("").join(" ")}
          >
            {friendCode}
          </Text>
          <Pressable
            onPress={copyCode}
            accessibilityRole="button"
            accessibilityLabel={copied ? t("copied") : t("copy")}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.strongRaised, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={c.strongText} />
          </Pressable>
          <Pressable
            onPress={shareCode}
            accessibilityRole="button"
            accessibilityLabel={t("share")}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="share-social-outline" size={16} color={c.primaryText} />
          </Pressable>
        </View>
        <Text style={{ color: c.strongMuted, fontSize: 12.5 }}>{t("friendCodeHint")}</Text>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: c.text }}>{t("addFriend")}</Text>
        <PillInput
          icon="people-outline"
          placeholder={t("friendCodePlaceholder")}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          returnKeyType="go"
          onSubmitEditing={addFriend}
        />
        {codeError && <Text style={{ color: c.danger, fontSize: 13 }}>{codeError}</Text>}
        <Button title={t("startChat")} variant="dark" icon="chatbubble-ellipses-outline" loading={busy === "friend"} disabled={!code.trim()} onPress={addFriend} />
        {isDemo && <T variant="small">{t("demoFriendHint", { code: DEMO_FRIEND.friendCode })}</T>}
      </View>
    </View>
  );

  const listPane = (
    <View style={{ gap: 14 }}>
      <OfflineNotice visible={offline} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <T variant="title">{t("messages")}</T>
        </View>
        <Pressable
          onPress={() => setShowNew((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showNew ? t("closePanel") : t("newChat")}
          accessibilityState={{ expanded: showNew }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            height: 40,
            paddingHorizontal: 14,
            borderRadius: 20,
            backgroundColor: showNew ? c.background : c.primary,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name={showNew ? "close" : "create-outline"} size={17} color={showNew ? c.text : c.primaryText} />
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: showNew ? c.text : c.primaryText }}>{showNew ? t("closePanel") : t("newChat")}</Text>
        </Pressable>
      </View>

      {newChatPanel}

      <PillInput icon="search" placeholder={t("searchConversations")} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />

      <View style={{ flexDirection: "row", gap: 8 }} accessibilityRole="tablist">
        <FilterChip label={t("filterAll")} active={filter === "all"} onPress={() => setFilter("all")} />
        <FilterChip label={t("filterUnread")} count={unreadTotal} active={filter === "unread"} onPress={() => setFilter("unread")} />
      </View>

      <View style={{ gap: 2, marginHorizontal: -6 }}>
        {visible.map((conv) => (
          <ConversationRow
            key={conv.id}
            conversation={conv}
            pinned={conv.kind === "support"}
            selected={wide && selected === conv.id}
            onPress={() => pressRow(conv)}
          />
        ))}
        {visible.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 24, gap: 6 }}>
            <Ionicons name={q ? "search" : "checkmark-done-circle-outline"} size={26} color={c.faint} />
            <Text style={{ color: c.muted, textAlign: "center" }}>{q ? t("noResults", { q: query.trim() }) : t("noUnread")}</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 8, backgroundColor: c.tiles.lemon.bg, borderRadius: 16, padding: 12 }}>
        <Ionicons name="shield-checkmark-outline" size={16} color={c.tiles.lemon.ink} />
        <Text style={{ flex: 1, fontSize: 12.5, color: c.tiles.lemon.ink }}>{t("safetyTip")}</Text>
      </View>
    </View>
  );

  if (!wide) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ backgroundColor: c.card, borderRadius: 24, padding: 16 }}>{listPane}</View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["top", "right"]}>
      <View style={{ flex: 1, flexDirection: "row", gap: 18, padding: 24, paddingLeft: 10 }}>
        <View style={{ width: 380, backgroundColor: c.card, borderRadius: 26, overflow: "hidden" }}>
          <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
            {listPane}
          </ScrollView>
        </View>
        <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 26, overflow: "hidden" }}>
          {selected ? (
            <ChatView key={selected} conversationId={selected} onActivity={refresh} />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12, backgroundColor: c.background }}>
              <Mascot size={170} accessories={["cap"]} intro />
              <Text style={{ fontSize: 20, fontWeight: "800", color: c.text, letterSpacing: -0.3 }}>{t("pickConversation")}</Text>
              <Text style={{ color: c.muted, textAlign: "center", maxWidth: 340, lineHeight: 20 }}>{t("pickConversationHint")}</Text>
              <View style={{ marginTop: 8 }}>
                <Button title={t("supportTeam")} icon="school-outline" variant="dark" compact loading={busy === "support"} onPress={() => pressRow(support)} />
              </View>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
