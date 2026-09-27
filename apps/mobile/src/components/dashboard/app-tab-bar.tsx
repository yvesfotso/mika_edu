import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnreadMessages } from "@/lib/messages";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Minimal slice of the navigator's tab-bar props that this component uses. */
export interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

const ICONS: Record<string, [IconName, IconName]> = {
  index: ["grid-outline", "grid"],
  subjects: ["library-outline", "library"],
  progress: ["stats-chart-outline", "stats-chart"],
  messages: ["chatbubbles-outline", "chatbubbles"],
  profile: ["person-outline", "person"],
};

function useTabItems({ state, descriptors, navigation }: TabBarProps) {
  return state.routes.map((route, index) => {
    const focused = state.index === index;
    return {
      key: route.key,
      name: route.name,
      label: descriptors[route.key]?.options.title ?? route.name,
      icons: ICONS[route.name] ?? (["ellipse-outline", "ellipse"] as [IconName, IconName]),
      focused,
      onPress: () => {
        const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
      },
    };
  });
}

/** Dark vertical navigation for wide screens. */
function UnreadDot({ count, onDark }: { count: number; onDark?: boolean }) {
  const c = useColors();
  if (count <= 0) return null;
  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 5,
        backgroundColor: onDark ? c.tiles.peach.bg : c.danger,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityLabel={String(count)}
    >
      <Text style={{ fontSize: 11, fontWeight: "800", color: onDark ? c.tiles.peach.ink : "#FFFFFF" }}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

export function Sidebar(props: TabBarProps) {
  const c = useColors();
  const unread = useUnreadMessages(true);
  const { t } = useSession();
  const items = useTabItems(props);
  const insets = useSafeAreaInsets();
  const openSubjects = () => props.navigation.navigate("subjects");

  return (
    <View style={{ width: 232, padding: 14, paddingTop: 14 + insets.top, backgroundColor: c.background }}>
      <View style={{ flex: 1, backgroundColor: c.strong, borderRadius: 24, padding: 16, justifyContent: "space-between" }}>
        <View style={{ gap: 26 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 6, paddingTop: 6 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="school" size={18} color={c.strong} />
            </View>
            <Text style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "700", letterSpacing: -0.3 }}>{t("appName")}</Text>
          </View>

          <View style={{ gap: 6 }} accessibilityRole="tablist">
            {items.map((item) => (
              <Pressable
                key={item.key}
                onPress={item.onPress}
                accessibilityRole="tab"
                accessibilityState={{ selected: item.focused }}
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: item.focused ? c.primary : hovered || pressed ? c.strongRaised : "transparent",
                })}
              >
                <Ionicons name={item.focused ? item.icons[1] : item.icons[0]} size={18} color={item.focused ? c.primaryText : c.strongMuted} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: item.focused ? "700" : "500", color: item.focused ? c.primaryText : c.strongMuted }}>
                  {item.label}
                </Text>
                {item.name === "messages" && <UnreadDot count={unread} onDark />}
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable onPress={openSubjects} accessibilityRole="button" style={{ backgroundColor: c.primary, borderRadius: 20, padding: 16, paddingTop: 30, marginTop: 24 }}>
          <View
            style={{
              position: "absolute",
              top: -18,
              alignSelf: "center",
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: c.card,
              borderWidth: 3,
              borderColor: c.strong,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="cloud-download-outline" size={18} color={c.text} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: "700", color: c.primaryText }}>{t("studyOffline")}</Text>
          <Text style={{ fontSize: 12, color: c.primaryText, opacity: 0.75, marginTop: 4 }}>{t("studyOfflineText")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Bottom navigation for phones, styled to match the sidebar. */
export function BottomBar(props: TabBarProps) {
  const c = useColors();
  const { t } = useSession();
  const unread = useUnreadMessages(true);
  const items = useTabItems(props);
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        backgroundColor: c.strong,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingHorizontal: 8,
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.focused }}
          accessibilityLabel={item.label}
          style={{ flex: 1, alignItems: "center", gap: 3 }}
        >
          <View style={{ paddingHorizontal: 16, paddingVertical: 5, borderRadius: 999, backgroundColor: item.focused ? c.primary : "transparent" }}>
            <Ionicons name={item.focused ? item.icons[1] : item.icons[0]} size={20} color={item.focused ? c.primaryText : c.strongMuted} />
            {item.name === "messages" && unread > 0 && (
              <View style={{ position: "absolute", top: -4, right: 4 }}>
                <UnreadDot count={unread} />
              </View>
            )}
          </View>
          <Text style={{ fontSize: 11, color: item.focused ? "#FFFFFF" : c.strongMuted, fontWeight: item.focused ? "700" : "400" }} numberOfLines={1}>
            {item.name === "index" ? t("home") : item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
