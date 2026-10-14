import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { AuthLayout } from "@/components/auth-layout";
import type { MascotMood } from "@/components/mascot/mascot";
import { PillInput } from "@/components/text-field";
import { Button } from "@/components/ui";
import { auth } from "@/lib/auth";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

export default function SignUp() {
  const c = useColors();
  const { t, locale } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<"name" | "email" | "password" | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (busy) return;
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError(password.length < 8 && name.trim() && email.trim() ? t("passwordHint") : t("missingSignUp"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error, needsConfirmation } = await auth.signUp(email.trim(), password, {
      displayName: name.trim(),
      preferredLanguage: locale,
    });
    setBusy(false);
    if (error) setError(error);
    else if (needsConfirmation) setNotice(t("checkEmail"));
    else router.replace("/onboarding");
  }

  const mood: MascotMood = notice
    ? "happy"
    : error
      ? "error"
      : focus === "password" && !showPassword
        ? "shy"
        : focus || busy
          ? "look"
          : "idle";
  const typed = focus === "name" ? name : focus === "email" ? email : focus === "password" ? password : null;
  const gaze = typed === null ? undefined : Math.min(1, typed.length / (focus === "password" ? 16 : 28));
  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setError(null);
  };
  const blurFrom = (field: typeof focus) => () => setFocus((f) => (f === field ? null : f));

  const small = { fontSize: 12.5, color: c.text };

  return (
    <AuthLayout title={t("getStarted")} subtitle={t("signUpSubtitle")} mood={mood} gaze={gaze}>
      <View style={{ gap: 12 }}>
        <PillInput
          icon="person"
          placeholder={t("name")}
          value={name}
          onChangeText={edit(setName)}
          onFocus={() => setFocus("name")}
          onBlur={blurFrom("name")}
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <PillInput
          ref={emailRef}
          icon="mail"
          placeholder={t("email")}
          value={email}
          onChangeText={edit(setEmail)}
          onFocus={() => setFocus("email")}
          onBlur={blurFrom("email")}
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
          hint={t("passwordHint")}
          value={password}
          onChangeText={edit(setPassword)}
          onFocus={() => setFocus("password")}
          onBlur={blurFrom("password")}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>

      {error && (
        <Text style={{ color: c.danger, fontSize: 13, marginTop: 12, textAlign: "center" }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      {notice && (
        <Text style={{ color: c.success, fontSize: 13, marginTop: 12, textAlign: "center" }} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      )}

      <View style={{ marginTop: 22 }}>
        <Button title={t("signUp")} variant="dark" loading={busy} onPress={submit} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 26 }}>
        <Text style={[small, { color: c.muted }]}>{t("haveAccountShort")}</Text>
        <Pressable onPress={() => router.replace("/sign-in")} accessibilityRole="link" hitSlop={6}>
          <Text style={[small, { fontWeight: "700", textDecorationLine: "underline" }]}>{t("signIn")}</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}
