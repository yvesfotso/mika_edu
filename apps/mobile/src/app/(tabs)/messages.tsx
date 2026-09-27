import type { ConversationDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, Share, Text, View, useWindowDimensions } from "react-native";
import { Panel } from "@/components/dashboard/sections";
import { PillInput } from "@/components/text-field";
import { Button, OfflineNotice, Screen, StateView, T } from "@/components/ui";
import { VerifiedBadge } from "@/components/verified-badge";
import { DEMO_FRIEND } from "@/demo/messaging";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";
import { isDemo } from "@/lib/config";
import { notify } from "@/lib/dialog";
import { formatChatTime, refreshUnread } from "@/lib/messages";
import { SIDEBAR_BREAKPOINT, useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

function ConversationRow({ conversation, onPress }: { conversation: ConversationDto; onPress: () => void }) {
  const c = useColors();
  const { t, locale } = useSession();
  const support = conversation.kind === "support";
  const name = support ? t("supportTeam") : (conversation.peer?.displayName ?? "—");
  const unread = conversation.unreadCount > 0;
  const preview = conversation.lastMessage
    ? `${conversation.lastMessage.mine ? `${t("you")}: ` : ""}${conversation.lastMessage.body}`
    : support
      ? t("supportSubtitle")
      : t("noMessagesYet");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderRadius: 20, padding: 14, opacity: pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: support ? c.strong : c.tiles.lavender.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {support ? (
          <Ionicons name="school" size={22} color={c.primary} />
        ) : (
          <Text style={{ fontSize: 18, fontWeight: "800", color: c.tiles.lavender.ink }}>{name.trim()[0]?.toUpperCase() ?? "?"}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: unread ? "800" : "600", color: c.text, flexShrink: 1 }} numberOfLines={1}>
            {name}
          </Text>
          {(support || conversation.peer?.verified) && <VerifiedBadge />}
        </View>
        <Text style={{ fontSize: 13, color: unread ? c.text : c.muted, fontWeight: unread ? "600" : "400" }} numberOfLines={1}>
          {conversation.blocked ? t("blockedNotice") : preview}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        {conversation.lastMessage && (
          <Text style={{ fontSize: 11.5, color: c.muted }}>{formatChatTime(conversation.lastMessage.createdAt, locale, t("yesterday"))}</Text>
        )}
        {unread && (
          <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 11.5, fontWeight: "800", color: c.primaryText }}>{conversation.unreadCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function Messages() {
  const c = useColors();
  const { t, profile } = useSession();
  const { width } = useWindowDimensions();
  const wide = width >= SIDEBAR_BREAKPOINT;
  const { data, error, loading, offline, refresh } = useApi<{ conversations: ConversationDto[] }>("/conversations");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const friendCode = profile?.friendCode ?? "";

  async function openSupport() {
    setBusy("support");
    try {
      const { conversationId } = await api.post<{ conversationId: string }>("/conversations/support");
      router.push(`/chat/${conversationId}`);
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
      router.push(`/chat/${conversationId}`);
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

  const conversations = data.conversations;
  const hasSupport = conversations.some((conv) => conv.kind === "support");
  const open = (id: string) => {
    router.push(`/chat/${id}`);
    void refreshUnread();
  };

  const friendCodeCard = (
    <View style={{ backgroundColor: c.strong, borderRadius: 22, padding: 20, gap: 12, overflow: "hidden" }}>
      <View style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: c.strongRaised }} />
      <Text style={{ color: c.strongMuted, fontSize: 13 }}>{t("yourFriendCode")}</Text>
      <Text style={{ color: c.primary, fontSize: 34, fontWeight: "800", letterSpacing: 4 }} selectable accessibilityLabel={friendCode.split("").join(" ")}>
        {friendCode}
      </Text>
      <Text style={{ color: c.strongMuted, fontSize: 13 }}>{t("friendCodeHint")}</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Button title={t("share")} icon="share-social-outline" compact onPress={shareCode} />
        <Pressable
          onPress={copyCode}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, minHeight: 38, borderRadius: 999, backgroundColor: c.strongRaised }}
        >
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={15} color={c.strongText} />
          <Text style={{ color: c.strongText, fontWeight: "700", fontSize: 13.5 }}>{copied ? t("copied") : t("copy")}</Text>
        </Pressable>
      </View>
    </View>
  );

  const addFriendPanel = (
    <Panel title={t("addFriend")}>
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
    </Panel>
  );

  const list = (
    <View style={{ gap: 10 }}>
      <T variant="heading">{t("conversations")}</T>
      {!hasSupport && (
        <ConversationRow
          conversation={{ id: "support", kind: "support", peer: null, lastMessage: null, unreadCount: 0, blocked: false }}
          onPress={openSupport}
        />
      )}
      {conversations.map((conv) => (
        <ConversationRow key={conv.id} conversation={conv} onPress={() => open(conv.id)} />
      ))}
      <View style={{ flexDirection: "row", gap: 8, backgroundColor: c.tiles.lemon.bg, borderRadius: 16, padding: 12 }}>
        <Ionicons name="shield-checkmark-outline" size={16} color={c.tiles.lemon.ink} />
        <Text style={{ flex: 1, fontSize: 12.5, color: c.tiles.lemon.ink }}>{t("safetyTip")}</Text>
      </View>
    </View>
  );

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <OfflineNotice visible={offline} />
      <T variant="title">{t("messages")}</T>
      {wide ? (
        <View style={{ flexDirection: "row", gap: 22, alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>{list}</View>
          <View style={{ width: 360, gap: 18 }}>
            {friendCodeCard}
            {addFriendPanel}
          </View>
        </View>
      ) : (
        <>
          {list}
          {friendCodeCard}
          {addFriendPanel}
        </>
      )}
    </Screen>
  );
}
