import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";
import { AuthArt } from "./auth-art";

const WIDE_BREAKPOINT = 880;

/**
 * Split card for sign-in / sign-up: form on the left and artwork on the right on wide screens;
 * artwork banner above the form on phones.
 */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const c = useColors();
  const { t } = useSession();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  const header = (
    <View style={{ alignItems: "center" }}>
      {router.canGoBack() && (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          hitSlop={12}
          style={{ position: "absolute", left: -6, top: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={18} color={c.text} />
        </Pressable>
      )}
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.strong, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="school" size={24} color={c.primary} />
      </View>
      <Text style={{ fontSize: 30, fontWeight: "700", color: c.text, textAlign: "center", letterSpacing: -0.6, marginTop: 14 }} accessibilityRole="header">
        {title}
      </Text>
      <Text style={{ fontSize: 14, color: c.muted, textAlign: "center", marginTop: 6 }}>{subtitle}</Text>
    </View>
  );

  const form = (
    <View style={{ width: "100%", maxWidth: 360 }}>
      {header}
      <View style={{ marginTop: 32 }}>{children}</View>
    </View>
  );

  if (wide) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: c.strong }}>
        <View
          style={{
            width: Math.min(1120, width - 64),
            height: Math.min(780, height - 64),
            backgroundColor: c.card,
            borderRadius: 40,
            padding: 14,
            flexDirection: "row",
            gap: 14,
          }}
        >
          <ScrollView
            style={{ flex: 1.15 }}
            contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 32, paddingHorizontal: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {form}
          </ScrollView>
          <AuthArt style={{ flex: 1, borderRadius: 32 }} label={t("artCaption")} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.card }} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <AuthArt style={{ height: 200, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }} label={t("artCaption")} />
          <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 }}>{form}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
