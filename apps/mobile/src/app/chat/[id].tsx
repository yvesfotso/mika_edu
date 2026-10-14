import { router, Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatView } from "@/components/chat/chat-view";
import { useColors } from "@/lib/theme";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.card }} edges={["top", "left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      {id && (
        <ChatView
          key={id}
          conversationId={id}
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/messages"))}
        />
      )}
    </SafeAreaView>
  );
}
