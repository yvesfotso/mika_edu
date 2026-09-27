import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState, type ComponentProps } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { AuthLayout } from "@/components/auth-layout";
import { PillInput } from "@/components/text-field";
import { Button } from "@/components/ui";
import { DEMO_ACCOUNT } from "@/demo/server";
import { auth } from "@/lib/auth";
import { isDemo } from "@/lib/config";
import { notify } from "@/lib/dialog";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

type IconName = ComponentProps<typeof Ionicons>["name"];

function SocialButton({ icon, color, label, onPress }: { icon: IconName; color: string; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? c.background : c.card,
      })}
    >
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  );
}

export default function SignIn() {
  const c = useColors();
  const { t } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError(t("missingCredentials"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await auth.signIn(email.trim(), password, { remember });
    setBusy(false);
    if (error) setError(error);
    else router.replace("/");
  }

  const comingSoon = (feature: string) => notify(t("notAvailableYet", { feature }));
  const small = { fontSize: 12.5, color: c.text };

  return (
    <AuthLayout title={t("welcomeBack")} subtitle={t("enterDetails")}>
      <View style={{ gap: 12 }}>
        <PillInput
          icon="mail"
          placeholder={t("email")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <PillInput
          ref={passwordRef}
          icon={showPassword ? "eye-off" : "eye"}
          iconLabel={showPassword ? t("hidePassword") : t("showPassword")}
          onIconPress={() => setShowPassword((v) => !v)}
          placeholder={t("password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <Pressable
          onPress={() => setRemember((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: remember }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          hitSlop={6}
        >
          <Ionicons name={remember ? "checkbox" : "square-outline"} size={16} color={remember ? c.text : c.faint} />
          <Text style={small}>{t("rememberMe")}</Text>
        </Pressable>
        <Pressable onPress={() => comingSoon(t("passwordReset"))} accessibilityRole="link" hitSlop={6}>
          <Text style={[small, { color: c.muted }]}>{t("forgotPassword")}</Text>
        </Pressable>
      </View>

      {error && (
        <Text style={{ color: c.danger, fontSize: 13, marginTop: 12, textAlign: "center" }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      <View style={{ marginTop: 22 }}>
        <Button title={t("login")} variant="dark" loading={busy} onPress={submit} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 28 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <Text style={[small, { color: c.faint }]}>{t("or")}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 20 }}>
        <SocialButton icon="logo-apple" color={c.text} label={t("continueWith", { provider: "Apple" })} onPress={() => comingSoon("Apple")} />
        <SocialButton icon="logo-google" color="#EA4335" label={t("continueWith", { provider: "Google" })} onPress={() => comingSoon("Google")} />
        <SocialButton icon="logo-facebook" color="#1877F2" label={t("continueWith", { provider: "Facebook" })} onPress={() => comingSoon("Facebook")} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 26 }}>
        <Text style={[small, { color: c.muted }]}>{t("noAccount")}</Text>
        <Pressable onPress={() => router.push("/sign-up")} accessibilityRole="link" hitSlop={6}>
          <Text style={[small, { fontWeight: "700", textDecorationLine: "underline" }]}>{t("signUp")}</Text>
        </Pressable>
      </View>

      {isDemo && (
        <Pressable
          onPress={() => {
            setEmail(DEMO_ACCOUNT.email);
            setPassword(DEMO_ACCOUNT.password);
          }}
          accessibilityRole="button"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 14,
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: c.primary,
            alignSelf: "center",
          }}
        >
          <Ionicons name="flash" size={14} color={c.primaryText} />
          <Text style={{ fontSize: 12.5, color: c.primaryText, fontWeight: "600" }}>
            {t("useDemoAccount")}: {DEMO_ACCOUNT.email}
          </Text>
        </Pressable>
      )}
    </AuthLayout>
  );
}
