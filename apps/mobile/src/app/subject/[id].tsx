import { localize, type AttemptMode, type ChapterDto, type LocalizedText } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { subjectIcon, TileIcon } from "@/components/dashboard/tile-icon";
import { SkillRow, StatusChip } from "@/components/learning";
import { PackControl } from "@/components/pack-control";
import { Button, IconCircle, OfflineNotice, Screen, StateView, T } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { errorMessage } from "@/lib/api";
import { notify } from "@/lib/dialog";
import { startQuiz, type QuizScope } from "@/lib/learning";
import { usePackIndex } from "@/lib/packs";
import { spacing, toneFor, useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

interface ChaptersResponse {
  subject: { id: string; name: LocalizedText; icon: string | null } | null;
  chapters: ChapterDto[];
}

function ChapterCard({ chapter, busy, onPractise }: { chapter: ChapterDto; busy: string | null; onPractise: (key: string, scope: QuizScope) => void }) {
  const c = useColors();
  const { t, locale, userId } = useSession();
  const packs = usePackIndex(userId);
  const lessonsRead = chapter.lessons.filter((l) => l.completed).length;
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.strong, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: c.primary, fontWeight: "800" }}>{chapter.orderIndex + 1}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="heading">{localize(chapter.title, locale)}</T>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {chapter.questionCount > 0 && <StatusChip status={chapter.status} />}
            {chapter.lessons.length > 0 && <T variant="small">{t("lessonsReadOf", { n: lessonsRead, total: chapter.lessons.length })}</T>}
          </View>
        </View>
      </View>

      {chapter.openMistakes > 0 && (
        <Pressable
          onPress={() => router.navigate({ pathname: "/(tabs)/practice", params: { chapterId: chapter.id } })}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.tiles.peach.bg, borderRadius: 14, padding: 10 }}
        >
          <Ionicons name="alert-circle-outline" size={16} color={c.tiles.peach.ink} />
          <Text style={{ flex: 1, color: c.tiles.peach.ink, fontWeight: "700", fontSize: 13 }}>{t("openMistakesShort", { n: chapter.openMistakes })}</Text>
          <Ionicons name="chevron-forward" size={16} color={c.tiles.peach.ink} />
        </Pressable>
      )}

      {chapter.lessons.length > 0 && (
        <View style={{ gap: 6 }}>
          {chapter.lessons.map((lesson) => (
            <Pressable
              key={lesson.id}
              onPress={() => router.push(`/lesson/${lesson.id}`)}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, backgroundColor: c.background, opacity: pressed ? 0.7 : 1 })}
            >
              <TileIcon name={lesson.completed ? "checkmark-done-outline" : "book-outline"} tone={lesson.completed ? "mint" : "lavender"} size={34} />
              <View style={{ flex: 1 }}>
                <T style={{ fontSize: 14, fontWeight: "600" }} numberOfLines={2}>
                  {localize(lesson.title, locale)}
                </T>
                <T variant="small">{lesson.completed ? t("lessonRead") : t("minutes", { n: lesson.estimatedMinutes })}</T>
              </View>
              <IconCircle name="chevron-forward" />
            </Pressable>
          ))}
        </View>
      )}

      {chapter.questionCount > 0 && chapter.skills.length > 0 && (
        <View>
          <T variant="small" style={{ fontWeight: "700", marginBottom: 2 }}>
            {t("skillsTitle")}
          </T>
          {chapter.skills.map((s) => (
            <SkillRow key={s.key} skill={s} onPractise={s.skillId ? () => onPractise(`skill:${s.skillId}`, { skillId: s.skillId! }) : undefined} />
          ))}
        </View>
      )}

      {chapter.questionCount > 0 && (
        <Button title={t("practiceChapter")} variant="dark" icon="play" loading={busy === chapter.id} onPress={() => onPractise(chapter.id, { chapterId: chapter.id })} />
      )}
      {(chapter.lessons.length > 0 || chapter.questionCount > 0) && <PackControl chapterId={chapter.id} chapter={chapter} status={packs[chapter.id]} />}
    </View>
  );
}

export default function SubjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { t, locale, profile, userId } = useSession();
  const trackId = profile?.targetTrackId;
  const { data, error, loading, offline, refresh } = useApi<ChaptersResponse>(trackId && id ? `/tracks/${trackId}/subjects/${id}/chapters` : null);
  const [busy, setBusy] = useState<string | null>(null);

  async function start(key: string, scope: QuizScope, mode: AttemptMode = "practice") {
    if (!userId || busy) return;
    setBusy(key);
    try {
      const attemptId = await startQuiz(userId, scope, mode);
      router.push(`/quiz/${attemptId}`);
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <StateView loading={loading || !error} error={error} onRetry={refresh} />;

  const title = data.subject ? localize(data.subject.name, locale) : "";
  const hasQuestions = data.chapters.some((ch) => ch.questionCount > 0);

  return (
    <Screen refreshing={loading} onRefresh={refresh} edges={["left", "right", "bottom"]} maxWidth={860}>
      <Stack.Screen options={{ title }} />
      <OfflineNotice visible={offline} />

      <View style={{ backgroundColor: c.strong, borderRadius: 22, padding: 20, gap: 16, overflow: "hidden" }}>
        <View style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: c.strongRaised }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {data.subject && <TileIcon name={subjectIcon(data.subject.icon)} tone={toneFor(data.subject.id)} size={50} />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.strongText, fontSize: 22, fontWeight: "700", letterSpacing: -0.4 }} accessibilityRole="header">
              {title}
            </Text>
            <Text style={{ color: c.strongMuted, fontSize: 13, marginTop: 2 }}>{t("chapters", { n: data.chapters.length })}</Text>
          </View>
        </View>
        {hasQuestions && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <Button title={t("timedMock")} icon="timer-outline" compact loading={busy === "mock"} onPress={() => start("mock", { subjectId: id }, "mock")} />
            <Pressable
              onPress={() => start("past", { subjectId: id }, "past_paper")}
              disabled={busy === "past"}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, minHeight: 38, borderRadius: 999, backgroundColor: c.strongRaised }}
            >
              {busy === "past" ? <ActivityIndicator color={c.strongText} /> : <Ionicons name="document-text-outline" size={15} color={c.strongText} />}
              <Text style={{ color: c.strongText, fontWeight: "700", fontSize: 13.5 }}>{t("pastPapers")}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {data.chapters.length === 0 && <T variant="muted">{t("noContentYet")}</T>}
      {data.chapters.map((ch) => (
        <ChapterCard key={ch.id} chapter={ch} busy={busy} onPractise={(key, scope) => void start(key, scope)} />
      ))}
    </Screen>
  );
}
