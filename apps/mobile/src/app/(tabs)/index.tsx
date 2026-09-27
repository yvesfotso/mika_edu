import { localize, type AttemptMode, type DashboardDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { MonthCalendar } from "@/components/dashboard/month-calendar";
import {
  ExamCard,
  LinkText,
  Panel,
  PlanList,
  PlusButton,
  RecentQuizzes,
  RecommendedRow,
  SectionTitle,
  SubjectRows,
  type PlanItem,
  type RecentAttempt,
} from "@/components/dashboard/sections";
import { OfflineNotice, StateView } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { errorMessage } from "@/lib/api";
import { useColors, SIDEBAR_BREAKPOINT } from "@/lib/theme";
import { notify } from "@/lib/dialog";
import { startQuiz } from "@/lib/learning";
import { useSession } from "@/providers/session";

function Avatar({ name }: { name: string }) {
  const c = useColors();
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.tiles.lavender.bg, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.card }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: c.tiles.lavender.ink }}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </View>
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

export default function Dashboard() {
  const c = useColors();
  const { t, locale, profile, userId } = useSession();
  const { width } = useWindowDimensions();
  const wide = width >= SIDEBAR_BREAKPOINT;
  const dashboard = useApi<DashboardDto>("/me/dashboard");
  const attempts = useApi<{ attempts: RecentAttempt[] }>("/me/attempts");
  const [busy, setBusy] = useState<string | null>(null);
  const data = dashboard.data;

  const activeDates = useMemo(() => new Set((data?.activity ?? []).filter((d) => d.minutes > 0).map((d) => d.date)), [data]);

  async function start(key: string, scope: { chapterId?: string; subjectId?: string }, mode: AttemptMode) {
    if (!userId || busy) return;
    setBusy(key);
    try {
      const id = await startQuiz(userId, scope, mode);
      router.push(`/quiz/${id}`);
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <StateView loading={dashboard.loading || !dashboard.error} error={dashboard.error} onRetry={dashboard.refresh} />
      </SafeAreaView>
    );
  }

  const name = profile?.displayName ?? data.profile.displayName ?? "";
  const today = data.activity.at(-1)?.date ?? "";
  const withContent = data.subjects.filter((s) => s.chapterCount > 0);
  const weakest = [...withContent].sort((a, b) => a.mastery - b.mastery)[0];
  const topRec = data.recommendations[0];
  const onMock = weakest ? () => start("mock", { subjectId: weakest.id }, "mock") : undefined;
  const recentAttempts = (attempts.data?.attempts ?? []).slice(0, 4);

  const plan: PlanItem[] = [];
  if (data.continueLesson) {
    const lesson = data.continueLesson;
    plan.push({
      key: "lesson",
      icon: "book-outline",
      tone: "lavender",
      title: localize(lesson.title, locale),
      subtitle: t("planLesson", { chapter: localize(lesson.chapterTitle, locale) }),
      onPress: () => router.push(`/lesson/${lesson.id}`),
    });
  }
  if (topRec) {
    plan.push({
      key: "practise",
      icon: "flash-outline",
      tone: "mint",
      title: t("planPractise", { chapter: localize(topRec.chapterTitle, locale) }),
      subtitle: localize(topRec.subjectName, locale),
      onPress: () => start("plan-practise", { chapterId: topRec.chapterId }, "practice"),
      busy: busy === "plan-practise",
    });
  }
  plan.push({
    key: "goal",
    icon: "time-outline",
    tone: "peach",
    title: t("dailyGoal"),
    subtitle: t("planGoal", { done: data.todayMinutes, goal: data.profile.dailyGoalMinutes }),
  });
  if (weakest) {
    plan.push({
      key: "mock",
      icon: "timer-outline",
      tone: "sky",
      title: t("timedMock"),
      subtitle: localize(weakest.name, locale),
      onPress: onMock,
      busy: busy === "mock",
    });
  }

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

  const recommended = data.recommendations.length > 0 && (
    <View style={{ gap: 12 }}>
      <SectionTitle title={t("recommended")} action={<LinkText label={t("viewAll")} onPress={() => router.navigate("/(tabs)/subjects")} />} />
      <RecommendedRow recs={data.recommendations} busyId={busy} onPractise={(id) => start(id, { chapterId: id }, "practice")} horizontal={!wide} />
    </View>
  );

  const activityPanel = (
    <Panel title={t("studyActivity")} style={wide ? { flex: 1 } : undefined}>
      <ActivityChart activity={data.activity} />
    </Panel>
  );

  const planPanel = (
    <Panel title={t("todaysPlan")} style={wide ? { flex: 1 } : undefined}>
      <PlanList items={plan} />
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
      <SectionTitle
        title={t("recentActivity")}
        action={topRec ? <PlusButton label={t("practice")} busy={busy === "plus"} onPress={() => start("plus", { chapterId: topRec.chapterId }, "practice")} /> : undefined}
      />
      <RecentQuizzes attempts={recentAttempts} onOpen={(id) => router.push(`/results/${id}`)} />
    </View>
  );

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
              {recommended}
              <View style={{ flexDirection: "row", gap: 16 }}>
                {activityPanel}
                {planPanel}
              </View>
              {subjectsSection}
            </View>
            <View style={{ width: 330, gap: 18 }}>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
                <StreakChip days={data.streak.currentDays} active={data.streak.activeToday} />
                <Avatar name={name} />
              </View>
              <ExamCard data={data} onMock={onMock} busy={busy === "mock"} />
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
            <ExamCard data={data} onMock={onMock} busy={busy === "mock"} />
            {recommended}
            {planPanel}
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
