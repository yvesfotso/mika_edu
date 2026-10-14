import { isLocale } from "@eduprep/core";
import { Stack, useGlobalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColors, useColorSchemeName } from "@/lib/theme";
import { SessionProvider, useSession } from "@/providers/session";

function ThemedStatusBar() {
  return <StatusBar style={useColorSchemeName() === "dark" ? "light" : "dark"} />;
}

/**
 * Links from the website (apps/web) carry `?lang=en|fr`, so a visitor keeps the language they were
 * reading. Applied once per link and only when signed out: a learner's profile language wins.
 */
function LanguageFromLink() {
  const { lang } = useGlobalSearchParams<{ lang?: string }>();
  const { initializing, userId, setLocale } = useSession();
  const applied = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (initializing || userId || !isLocale(lang) || applied.current === lang) return;
    applied.current = lang;
    setLocale(lang);
  }, [lang, initializing, userId, setLocale]);
  return null;
}

function RootStack() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: "700", fontSize: 17 },
        contentStyle: { backgroundColor: c.background },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="diagnostic" options={{ title: "" }} />
      <Stack.Screen name="offline-practice/[chapterId]" options={{ title: "" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="subject/[id]" options={{ title: "" }} />
      <Stack.Screen name="lesson/[id]" options={{ title: "" }} />
      <Stack.Screen name="quiz/[id]" options={{ title: "", gestureEnabled: false }} />
      <Stack.Screen name="results/[id]" options={{ title: "", headerBackVisible: false }} />
      <Stack.Screen name="chat/[id]" options={{ title: "" }} />
      <Stack.Screen name="program-settings" options={{ title: "" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <LanguageFromLink />
        <ThemedStatusBar />
        <RootStack />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
