import { Redirect, Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { BottomBar, Sidebar, type TabBarProps } from "@/components/dashboard/app-tab-bar";
import { useColors, SIDEBAR_BREAKPOINT } from "@/lib/theme";
import { useSession } from "@/providers/session";

/**
 * Today · Learn · Practice · Progress · Messages. Profile is reached from the avatar (and the sidebar
 * on wide screens). There is no Tutor tab until a working tutor exists.
 */
export default function TabsLayout() {
  const c = useColors();
  const { session, initializing, t } = useSession();
  const { width } = useWindowDimensions();
  const wide = width >= SIDEBAR_BREAKPOINT;
  if (!initializing && !session) return <Redirect href="/welcome" />;

  return (
    <Tabs
      tabBar={(props) => (wide ? <Sidebar {...(props as unknown as TabBarProps)} /> : <BottomBar {...(props as unknown as TabBarProps)} />)}
      screenOptions={{ headerShown: false, tabBarPosition: wide ? "left" : "bottom", sceneStyle: { backgroundColor: c.background } }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabToday") }} />
      <Tabs.Screen name="subjects" options={{ title: t("tabLearn") }} />
      <Tabs.Screen name="practice" options={{ title: t("tabPractice") }} />
      <Tabs.Screen name="progress" options={{ title: t("progress") }} />
      <Tabs.Screen name="messages" options={{ title: t("messages") }} />
      <Tabs.Screen name="profile" options={{ title: t("profile") }} />
    </Tabs>
  );
}
