import type { DashboardDto, StudyTaskDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { MonthCalendar } from "@/components/dashboard/month-calendar";
import {
  ExamCard,
  LinkText,
  Panel,
  RecentQuizzes,
  SectionTitle,
  SubjectRows,
  type RecentAttempt,
} from "@/components/dashboard/sections";
import { TodayPlanPanel } from "@/components/dashboard/today";
import { OfflineNotice, StateView } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { errorMessage } from "@/lib/api";
import { notify } from "@/lib/dialog";
import { startQuiz } from "@/lib/learning";
import { useColors, SIDEBAR_BREAKPOINT } from "@/lib/theme";
import { useSession } from "@/providers/session";

function Avatar({ name }: { name: string }) {
  const c = useColors();
  const { t } = useSession();
  return (
    <Pressable
      onPress={() => router.navigate("/(tabs)/profile")}
      accessibilityRole="button"
      accessibilityLabel={t("profile")}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.tiles.lavender.bg, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.card }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: c.tiles.lavender.ink }}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </Pressable>
  );
}

function StreakChip({ days, active }: { days: number; active: boolean }) {
  const c = useColors();
  const { t } = useSession();
  return (
    <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}>
      <Ionicons name="flame" size={16} color={active ? "#F97316" : c.faint} />
      <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }}>{t("streak", { n: days })}</Text>
    </View>
  );
}

export default function Today() {
  const c = useColors();
  const { t, profile, userId } = useSession();
  const { width } = useWindowDimensions();
  const wide = width >= SIDEBAR_BREAKPOINT;
  const dashboard = useApi<DashboardDto>("/me/dashboard");
  const attempts = useApi<{ attempts: RecentAttempt[] }>("/me/attempts");
  const [busy, setBusy] = useState<string | null>(null);
  const data = dashboard.data;

  const activeDates = useMemo(() => new Set((data?.activity ?? []).filter((d) => d.minutes > 0).map((d) => d.date)), [data]);

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <StateView loading={dashboard.loading || !dashboard.error} error={dashboard.error} onRetry={dashboard.refresh} />
      </SafeAreaView>
    );
  }

  /** Each task opens the activity that completes it. */
  async function openTask(task: StudyTaskDto) {
    if (!userId || busy) return;
    if (task.kind === "diagnostic") {
      router.push("/diagnostic");
      return;
    }
    if (task.target.lessonId) {
      router.push(`/lesson/${task.target.lessonId}`);
      return;
    }
    setBusy(task.id);
    try {
      const scope = task.target.skillId ? { skillId: task.target.skillId } : { chapterId: task.target.chapterId };
      const mode = task.kind === "recover_mistakes" ? "recovery" : "practice";
      const attemptId = await startQuiz(userId, scope, mode, mode === "recovery" ? 3 : 10);
      router.push(`/quiz/${attemptId}`);
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setBusy(null);
    }
  }

  async function startMock(subjectId: string) {
    if (!userId || busy) return;
    setBusy("mock");
    try {
      router.push(`/quiz/${await startQuiz(userId, { subjectId }, "mock")}`);
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setBusy(null);
    }
  }

  const name = profile?.displayName ?? data.profile.displayName ?? "";
  const today = data.activity.at(-1)?.date ?? "";
  const withContent = data.subjects.filter((s) => s.chapterCount > 0);
  const weakest = [...withContent].sort((a, b) => a.mastery - b.mastery)[0];
  const recentAttempts = (attempts.data?.attempts ?? []).slice(0, 4);

  const refreshing = dashboard.loading || attempts.loading;
  const refresh = () => {
    void dashboard.refresh();
    void attempts.refresh();
  };

  const welcome = (
    <Text style={{ fontSize: wide ? 28 : 24, fontWeight: "700", color: c.text, letterSpacing: -0.6, flexShrink: 1 }} accessibilityRole="header">
      {t("welcomeBackName", { name })} 👋
    </Text>
  );

  const planPanel = <TodayPlanPanel plan={data.today} busy={busy} onStart={(task) => void openTask(task)} />;

  const mistakesLink = data.today.openMistakes > 0 && (
    <Pressable
      onPress={() => router.navigate("/(tabs)/practice")}
      accessibilityRole="button"
      style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.tiles.peach.bg, borderRadius: 18, padding: 14 }}
    >
      <Ionicons name="bandage-outline" size={18} color={c.tiles.peach.ink} />
      <Text style={{ flex: 1, fontWeight: "700", color: c.tiles.peach.ink }}>{t("openMistakesShort", { n: data.today.openMistakes })}</Text>
      <Text style={{ fontSize: 13, fontWeight: "700", color: c.tiles.peach.ink, textDecorationLine: "underline" }}>{t("reviewMistakes")}</Text>
    </Pressable>
  );

  const activityPanel = (
    <Panel title={t("studyActivity")} style={wide ? { flex: 1 } : undefined}>
      <ActivityChart activity={data.activity} />
    </Panel>
  );

  const subjectsSection = withContent.length > 0 && (
    <View style={{ gap: 12 }}>
      <SectionTitle title={t("yourSubjects")} action={<LinkText label={t("viewAll")} onPress={() => router.navigate("/(tabs)/subjects")} />} />
      <SubjectRows subjects={withContent} onOpen={(id) => router.push(`/subject/${id}`)} />
    </View>
  );

  const calendarPanel = (
    <Panel>
      <MonthCalendar today={today} activeDates={activeDates} />
      <Text style={{ fontSize: 11, color: c.muted }}>{t("studiedDays")}</Text>
    </Panel>
  );

  const quizzesSection = (
    <View style={{ gap: 12 }}>
      <SectionTitle title={t("recentActivity")} />
      <RecentQuizzes attempts={recentAttempts} onOpen={(id) => router.push(`/results/${id}`)} />
    </View>
  );

  const examCard = <ExamCard data={data} onMock={weakest ? () => void startMock(weakest.id) : undefined} busy={busy === "mock"} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={wide ? ["top", "right"] : ["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: wide ? 24 : 16, paddingLeft: wide ? 10 : 16, gap: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <OfflineNotice visible={dashboard.offline} />
        {wide ? (
          <View style={{ flexDirection: "row", gap: 22, alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 22, minWidth: 0 }}>
              {welcome}
              {planPanel}
              {mistakesLink}
              {activityPanel}
              {subjectsSection}
            </View>
            <View style={{ width: 330, gap: 18 }}>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
                <StreakChip days={data.streak.currentDays} active={data.streak.activeToday} />
                <Avatar name={name} />
              </View>
              {examCard}
              {calendarPanel}
              {quizzesSection}
            </View>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>{welcome}</View>
              <Avatar name={name} />
            </View>
            <StreakChip days={data.streak.currentDays} active={data.streak.activeToday} />
            {planPanel}
            {mistakesLink}
            {examCard}
            {activityPanel}
            {subjectsSection}
            {calendarPanel}
            {quizzesSection}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
