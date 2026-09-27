import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Screen, T } from "@/components/ui";
import { DEMO_ACCOUNT } from "@/demo/server";
import { auth } from "@/lib/auth";
import { isDemo } from "@/lib/config";
import { spacing, useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

const LANGUAGES = [
  ["en", "English"],
  ["fr", "Français"],
] as const;

export default function Welcome() {
  const c = useColors();
  const { t, locale, setLocale } = useSession();
  const [demoBusy, setDemoBusy] = useState(false);

  async function tryDemo() {
    setDemoBusy(true);
    await auth.signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
    setDemoBusy(false);
    router.replace("/");
  }

  return (
    <Screen maxWidth={520}>
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg, minHeight: 600 }}>
        <Card tone="strong" style={{ padding: 26, gap: 14, overflow: "hidden" }}>
          <View style={{ position: "absolute", right: -40, top: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: c.strongRaised }} />
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: c.primary,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ rotate: "-8deg" }],
            }}
          >
            <Ionicons name="school" size={30} color={c.primaryText} />
          </View>
          <Text style={{ color: c.strongText, fontSize: 34, fontWeight: "800", letterSpacing: -0.8 }} accessibilityRole="header">
            {t("appName")}
          </Text>
          <Text style={{ color: c.strongMuted, fontSize: 15, lineHeight: 22 }}>{t("tagline")}</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            <Button title={t("getStarted")} onPress={() => router.push("/sign-up")} />
            <Pressable onPress={() => router.push("/sign-in")} accessibilityRole="button" style={{ alignItems: "center", paddingVertical: 10 }}>
              <Text style={{ color: c.strongText, fontSize: 14.5, fontWeight: "600", textDecorationLine: "underline" }}>{t("haveAccount")}</Text>
            </Pressable>
          </View>
        </Card>

        <Card>
          <T variant="heading">{t("chooseLanguage")}</T>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {LANGUAGES.map(([code, label]) => {
              const selected = locale === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => setLocale(code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 999,
                    backgroundColor: selected ? c.primary : c.background,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "700", color: selected ? c.primaryText : c.text }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {isDemo && (
          <Card style={{ backgroundColor: c.tiles.lemon.bg }}>
            <Text style={{ fontSize: 13, color: c.tiles.lemon.ink }}>{t("demoMode")}</Text>
            <Text style={{ fontSize: 13, color: c.text, fontWeight: "600" }}>
              {DEMO_ACCOUNT.email} / {DEMO_ACCOUNT.password}
            </Text>
            <Button title={t("tryDemo")} variant="dark" icon="flash" loading={demoBusy} onPress={tryDemo} />
          </Card>
        )}
      </View>
    </Screen>
  );
}
