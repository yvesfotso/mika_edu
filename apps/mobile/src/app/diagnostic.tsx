import { localize, type DashboardDto, type SkillProgressDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Mascot } from "@/components/mascot/mascot";
import { StatusChip } from "@/components/learning";
import { useTaskText } from "@/components/dashboard/today";
import { Button, Screen, StateView, T } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";
import { notify } from "@/lib/dialog";
import { startQuiz } from "@/lib/learning";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

/**
 * The short check: what it is, and what it is not. Results are a first estimate from one question
 * per topic, so skills the learner doesn't answer stay "not assessed".
 */
export default function Diagnostic() {
  const c = useColors();
  const { t, locale, userId, profile, refreshProfile } = useSession();
  const [busy, setBusy] = useState(false);
  const done = profile?.diagnosticStatus === "completed";
  const dashboard = useApi<DashboardDto>(done ? "/me/dashboard" : null);
  const progress = useApi<{ subjects: { chapters: { skills: SkillProgressDto[] }[] }[] }>(done ? "/me/progress" : null);
  const taskText = useTaskText();

  async function start() {
    if (!userId) return;
    setBusy(true);
    try {
      router.replace(`/quiz/${await startQuiz(userId, {}, "diagnostic")}`);
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    try {
      await api.patch("/me", { diagnosticStatus: "skipped" });
      await refreshProfile();
      router.replace("/(tabs)");
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const skills = (progress.data?.subjects ?? []).flatMap((s) => s.chapters.flatMap((ch) => ch.skills)).filter((s) => s.evidence.distinctCorrect + s.evidence.incorrect > 0);
    const strengths = skills.filter((s) => s.evidence.distinctCorrect > 0);
    const toPractise = skills.filter((s) => s.evidence.incorrect > 0);
    const first = dashboard.data?.today.tasks[0];
    if (!progress.data) return <StateView loading={progress.loading} error={progress.error} onRetry={progress.refresh} />;
    return (
      <Screen maxWidth={620}>
        <Stack.Screen options={{ title: t("diagnosticTitle") }} />
        <Mascot size={120} mood="happy" accessories={["cap"]} intro style={{ alignSelf: "center" }} />
        <T variant="title">{t("diagnosticTitle")}</T>
        {strengths.length > 0 && (
          <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 16, gap: 8 }}>
            <T variant="heading">{t("diagnosticStrengths")}</T>
            {strengths.map((s) => (
              <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="checkmark-circle" size={16} color={c.success} />
                <T style={{ flex: 1 }}>{localize(s.name, locale)}</T>
                <StatusChip status={s.status} />
              </View>
            ))}
          </View>
        )}
        {toPractise.length > 0 && (
          <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 16, gap: 8 }}>
            <T variant="heading">{t("diagnosticToPractise")}</T>
            {toPractise.map((s) => (
              <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="alert-circle-outline" size={16} color={c.tiles.peach.ink} />
                <T style={{ flex: 1 }}>{localize(s.name, locale)}</T>
                <StatusChip status={s.status} />
              </View>
            ))}
          </View>
        )}
        {first && (
          <View style={{ backgroundColor: c.tiles.mint.bg, borderRadius: 22, padding: 16, gap: 4 }}>
            <T variant="small" style={{ fontWeight: "700", color: c.tiles.mint.ink }}>
              {t("diagnosticFirstTask")}
            </T>
            <T style={{ fontWeight: "700" }}>{taskText(first).label}</T>
            <T variant="small">{taskText(first).reason}</T>
          </View>
        )}
        <T variant="small">{t("diagnosticNote")}</T>
        <Button title={t("startLearning")} onPress={() => router.replace("/(tabs)")} />
      </Screen>
    );
  }

  return (
    <Screen maxWidth={620}>
      <Stack.Screen options={{ title: t("diagnosticTitle") }} />
      <Mascot size={130} accessories={["glasses"]} intro style={{ alignSelf: "center" }} />
      <T variant="title">{t("diagnosticTitle")}</T>
      <T variant="muted">{t("diagnosticIntro")}</T>
      <Button title={t("startDiagnostic")} icon="compass-outline" loading={busy} onPress={start} />
      <Button title={t("skipForNow")} variant="ghost" onPress={skip} />
    </Screen>
  );
}
