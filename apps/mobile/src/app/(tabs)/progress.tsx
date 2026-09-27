import { localize, type DashboardDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { Panel, RecentQuizzes, type RecentAttempt } from "@/components/dashboard/sections";
import { subjectIcon, TileIcon } from "@/components/dashboard/tile-icon";
import { OfflineNotice, pct, ProgressBar, Screen, StateView, T } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { SIDEBAR_BREAKPOINT, toneFor, useColors, type TileTone } from "@/lib/theme";
import { useSession } from "@/providers/session";

function StatTile({ icon, tone, label, value }: { icon: ComponentProps<typeof Ionicons>["name"]; tone: TileTone; label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, minWidth: 140, backgroundColor: c.card, borderRadius: 22, padding: 16, gap: 12 }}>
      <TileIcon name={icon} tone={tone} size={36} />
      <View>
        <Text style={{ fontSize: 12, color: c.muted }}>{label}</Text>
        <Text style={{ fontSize: 22, fontWeight: "700", color: c.text, marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

export default function Progress() {
  const c = useColors();
  const { t, locale } = useSession();
  const { width } = useWindowDimensions();
  const wide = width >= SIDEBAR_BREAKPOINT;
  const dashboard = useApi<DashboardDto>("/me/dashboard");
  const attempts = useApi<{ attempts: RecentAttempt[] }>("/me/attempts");
  const data = dashboard.data;

  if (!data) return <StateView loading={dashboard.loading || !dashboard.error} error={dashboard.error} onRetry={dashboard.refresh} />;

  const withContent = data.subjects.filter((s) => s.chapterCount > 0);
  const weekMinutes = data.activity.slice(-7).reduce((sum, d) => sum + d.minutes, 0);

  const overview = (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: c.strong, borderRadius: 22, padding: 20, flexDirection: "row", alignItems: "center", gap: 18, overflow: "hidden" }}>
        <View style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: c.strongRaised }} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: c.strongMuted, fontSize: 13 }}>{t("overallMastery")}</Text>
          <Text style={{ color: c.primary, fontSize: 44, fontWeight: "800", letterSpacing: -1 }}>{pct(data.overallMastery)}</Text>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.strongRaised, overflow: "hidden" }}>
            <View style={{ width: `${data.overallMastery * 100}%`, height: "100%", backgroundColor: c.primary, borderRadius: 4 }} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        <StatTile icon="flame-outline" tone="peach" label={t("streakNow")} value={t("days", { n: data.streak.currentDays })} />
        <StatTile icon="trophy-outline" tone="lemon" label={t("bestStreak")} value={t("days", { n: data.streak.bestDays })} />
        <StatTile icon="time-outline" tone="sky" label={t("thisWeek")} value={t("minutes", { n: weekMinutes })} />
      </View>
    </View>
  );

  const masteryPanel = (
    <Panel title={t("mastery")}>
      {withContent.map((s) => (
        <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TileIcon name={subjectIcon(s.icon)} tone={toneFor(s.id)} size={36} />
          <View style={{ flex: 1, gap: 6 }}>
            <T style={{ fontWeight: "600", fontSize: 14 }} numberOfLines={1}>
              {localize(s.name, locale)}
            </T>
            <ProgressBar value={s.mastery} color={s.mastery >= 0.7 ? c.success : s.mastery >= 0.4 ? c.warning : c.danger} />
          </View>
          <ProgressRing value={s.mastery} size={30} />
        </View>
      ))}
    </Panel>
  );

  const quizzes = (
    <View style={{ gap: 12 }}>
      <T variant="heading">{t("recentActivity")}</T>
      <RecentQuizzes attempts={attempts.data?.attempts ?? []} onOpen={(id) => router.push(`/results/${id}`)} />
    </View>
  );

  return (
    <Screen
      refreshing={dashboard.loading || attempts.loading}
      onRefresh={() => {
        void dashboard.refresh();
        void attempts.refresh();
      }}
    >
      <OfflineNotice visible={dashboard.offline} />
      <T variant="title">{t("progress")}</T>
      {wide ? (
        <View style={{ flexDirection: "row", gap: 22, alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 18 }}>
            {overview}
            <Panel title={t("studyActivity")}>
              <ActivityChart activity={data.activity} />
            </Panel>
            {masteryPanel}
          </View>
          <View style={{ width: 360 }}>{quizzes}</View>
        </View>
      ) : (
        <>
          {overview}
          <Panel title={t("studyActivity")}>
            <ActivityChart activity={data.activity} />
          </Panel>
          {masteryPanel}
          {quizzes}
        </>
      )}
    </Screen>
  );
}
