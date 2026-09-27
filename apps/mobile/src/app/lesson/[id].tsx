import { localize, type LessonDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { TileIcon } from "@/components/dashboard/tile-icon";
import { MarkdownView } from "@/components/markdown-view";
import { Button, OfflineNotice, Screen, StateView } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { cacheKey, errorMessage } from "@/lib/api";
import { notify } from "@/lib/dialog";
import { completeLesson, startQuiz } from "@/lib/learning";
import { store } from "@/lib/storage";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { t, locale, userId } = useSession();
  const path = id ? `/lessons/${id}` : null;
  const { data, error, loading, offline, refresh } = useApi<{ lesson: LessonDto }>(path);
  const [openedAt] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [doneLocally, setDoneLocally] = useState(false);
  const submitted = useRef(false);
  const [starting, setStarting] = useState(false);

  if (!data) return <StateView loading={loading || !error} error={error} onRetry={refresh} />;
  const { lesson } = data;
  const done = lesson.completed || doneLocally;

  async function markComplete() {
    if (!userId || submitted.current) return;
    submitted.current = true;
    setSaving(true);
    try {
      const outcome = await completeLesson(userId, lesson.id, (Date.now() - openedAt) / 1000);
      setDoneLocally(true);
      // Reflect completion in the saved copy so offline views stay consistent.
      store.set(cacheKey(userId, `/lessons/${lesson.id}`), { lesson: { ...lesson, completed: true } });
      if (outcome === "queued") notify(t("completedOffline"));
    } catch (err) {
      submitted.current = false;
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setSaving(false);
    }
  }

  async function practise() {
    if (!userId) return;
    setStarting(true);
    try {
      const attemptId = await startQuiz(userId, { chapterId: lesson.chapterId }, "practice");
      router.push(`/quiz/${attemptId}`);
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setStarting(false);
    }
  }

  return (
    <Screen edges={["left", "right", "bottom"]} maxWidth={780}>
      <Stack.Screen options={{ title: localize(lesson.title, locale) }} />
      <OfflineNotice visible={offline} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TileIcon name={done ? "checkmark-done-outline" : "book-outline"} tone={done ? "mint" : "lavender"} size={36} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Ionicons name="time-outline" size={14} color={c.muted} />
          <Text style={{ fontSize: 12.5, color: c.text, fontWeight: "600" }}>{t("minutes", { n: lesson.estimatedMinutes })}</Text>
        </View>
        {done && (
          <View style={{ backgroundColor: c.tiles.mint.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12.5, color: c.tiles.mint.ink, fontWeight: "700" }}>{t("completed")}</Text>
          </View>
        )}
      </View>
      <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 22 }}>
        <MarkdownView source={localize(lesson.body, locale)} />
      </View>
      {done ? (
        <Button title={t("practiceChapter")} variant="dark" icon="play" loading={starting} onPress={practise} />
      ) : (
        <Button title={t("markComplete")} icon="checkmark" loading={saving} onPress={markComplete} />
      )}
    </Screen>
  );
}
