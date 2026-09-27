import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColors, useColorSchemeName } from "@/lib/theme";
import { SessionProvider } from "@/providers/session";

function ThemedStatusBar() {
  return <StatusBar style={useColorSchemeName() === "dark" ? "light" : "dark"} />;
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
        <ThemedStatusBar />
        <RootStack />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
