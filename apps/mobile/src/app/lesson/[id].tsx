import { clampBlock, localize, splitLessonBlocks, type CheckpointResultDto, type LessonDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { TileIcon } from "@/components/dashboard/tile-icon";
import { AskCard, ReportProblem } from "@/components/learning";
import { MarkdownView } from "@/components/markdown-view";
import { Button, OfflineNotice, ProgressBar, Screen, StateView, T } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { cacheKey, errorMessage } from "@/lib/api";
import { notify } from "@/lib/dialog";
import { answerCheckpoint, completeLesson, saveLessonProgress, startQuiz } from "@/lib/learning";
import { lessonFromPack } from "@/lib/packs";
import { store } from "@/lib/storage";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

type Result = CheckpointResultDto & { queued?: boolean };

export default function LessonScreen() {
  const { id, block } = useLocalSearchParams<{ id: string; block?: string }>();
  const c = useColors();
  const { t, locale, userId } = useSession();
  const path = id ? `/lessons/${id}` : null;
  const api = useApi<{ lesson: LessonDto }>(path);
  const fromPack = useMemo(() => (!api.data && userId && id ? lessonFromPack(userId, id) : null), [api.data, userId, id]);
  const lesson = api.data?.lesson ?? fromPack;

  const [openedAt] = useState(() => Date.now());
  const [revealedBy, setRevealedBy] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busyQuestion, setBusyQuestion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [doneLocally, setDoneLocally] = useState(false);
  const [starting, setStarting] = useState(false);
  const submitted = useRef(false);

  const blocks = useMemo(() => (lesson ? splitLessonBlocks(localize(lesson.body, locale)) : []), [lesson, locale]);

  // Resume where the learner stopped, or at the section a mistake points to.
  const resumeAt = useMemo(() => {
    const target = block !== undefined ? Number(block) : (lesson?.progress.lastBlock ?? 0);
    return clampBlock(Number.isFinite(target) ? target : 0, blocks.length);
  }, [block, lesson, blocks.length]);

  if (!lesson) {
    return <StateView loading={api.loading || (!api.error && !api.offline)} error={api.error} onRetry={api.refresh} />;
  }
  const revealed = Math.max(revealedBy ?? 0, resumeAt);

  const done = lesson.completed || doneLocally;
  const checkpointsAfter = (i: number) => lesson.checkpoints.filter((cp) => clampBlock(cp.afterBlock, blocks.length) === i);
  const answered = (questionId: string) => results[questionId] ?? lesson.progress.checkpoints[questionId];
  const pendingHere = checkpointsAfter(revealed).filter((cp) => !answered(cp.question.id));
  const atEnd = revealed >= blocks.length - 1;
  const scored = lesson.checkpoints.filter((cp) => answered(cp.question.id));
  const right = scored.filter((cp) => answered(cp.question.id)!.correct).length;

  function next() {
    const nextBlock = Math.min(revealed + 1, blocks.length - 1);
    setRevealedBy(nextBlock);
    if (userId) saveLessonProgress(userId, lesson!, nextBlock);
  }

  async function check(questionId: string, answer: Parameters<typeof answerCheckpoint>[3]) {
    if (!userId) return;
    const cp = lesson!.checkpoints.find((x) => x.question.id === questionId)!;
    setBusyQuestion(questionId);
    try {
      const { result, queued } = await answerCheckpoint(userId, lesson!.id, cp.question, answer);
      setResults((prev) => ({ ...prev, [questionId]: { ...result, queued } }));
      const key = cacheKey(userId, `/lessons/${lesson!.id}`);
      const cached = store.get<{ lesson: LessonDto }>(key);
      if (cached) {
        const checkpoints = { ...cached.lesson.progress.checkpoints, [questionId]: { correct: result.correct, answeredAt: new Date().toISOString() } };
        store.set(key, { lesson: { ...cached.lesson, progress: { ...cached.lesson.progress, checkpoints } } });
      }
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setBusyQuestion(null);
    }
  }

  async function markComplete() {
    if (!userId || submitted.current) return;
    submitted.current = true;
    setSaving(true);
    try {
      const outcome = await completeLesson(userId, lesson!.id, (Date.now() - openedAt) / 1000);
      setDoneLocally(true);
      const key = cacheKey(userId, `/lessons/${lesson!.id}`);
      const cached = store.get<{ lesson: LessonDto }>(key);
      if (cached) store.set(key, { lesson: { ...cached.lesson, completed: true } });
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
      const attemptId = await startQuiz(userId, { chapterId: lesson!.chapterId }, "practice");
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
      <OfflineNotice visible={api.offline || Boolean(fromPack)} />

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <TileIcon name={done ? "checkmark-done-outline" : "book-outline"} tone={done ? "mint" : "lavender"} size={36} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Ionicons name="time-outline" size={14} color={c.muted} />
            <Text style={{ fontSize: 12.5, color: c.text, fontWeight: "600" }}>{t("minutes", { n: lesson.estimatedMinutes })}</Text>
          </View>
          {done && (
            <View style={{ backgroundColor: c.tiles.mint.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ fontSize: 12.5, color: c.tiles.mint.ink, fontWeight: "700" }}>{t("lessonRead")}</Text>
            </View>
          )}
          {fromPack && <T variant="small">{t("downloadedCopy")}</T>}
        </View>
        <T variant="small">{t("partOf", { i: revealed + 1, n: blocks.length })}</T>
        <ProgressBar value={(revealed + 1) / blocks.length} />
      </View>

      {blocks.slice(0, revealed + 1).map((md, i) => (
        <View key={i} style={{ gap: 12 }}>
          <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 22 }}>
            <MarkdownView source={md} />
          </View>
          {checkpointsAfter(i).map((cp) => {
            const prior = lesson.progress.checkpoints[cp.question.id];
            const result = results[cp.question.id];
            if (prior && !result) {
              return (
                <View key={cp.question.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.card, borderRadius: 16, padding: 12 }}>
                  <Ionicons name={prior.correct ? "checkmark-circle" : "close-circle"} size={18} color={prior.correct ? c.success : c.danger} />
                  <T style={{ flex: 1 }} numberOfLines={2}>
                    {localize(cp.question.prompt, locale)}
                  </T>
                  <T variant="small">{prior.correct ? t("correct") : t("incorrect")}</T>
                </View>
              );
            }
            return (
              <View key={cp.question.id} style={{ gap: 8 }}>
                <T variant="heading">{t("checkpointTitle")}</T>
                <AskCard
                  question={cp.question}
                  result={result ?? null}
                  busy={busyQuestion === cp.question.id}
                  onCheck={(answer) => void check(cp.question.id, answer)}
                  note={result?.queued ? t("checkedOffline") : undefined}
                />
              </View>
            );
          })}
        </View>
      ))}

      {!atEnd && <Button title={t("continue")} variant="dark" icon="arrow-down" disabled={pendingHere.length > 0 && !api.offline} onPress={next} />}
      {!atEnd && pendingHere.length > 0 && !api.offline && <T variant="small">{t("answerFirst")}</T>}

      {atEnd && (
        <View style={{ gap: 12 }}>
          {lesson.checkpoints.length > 0 && <T variant="muted">{t("checkpointScore", { ok: right, n: lesson.checkpoints.length })}</T>}
          {done ? (
            <Button title={t("practiceChapter")} variant="dark" icon="play" loading={starting} onPress={practise} />
          ) : (
            <Button title={t("markComplete")} icon="checkmark" loading={saving} onPress={markComplete} />
          )}
        </View>
      )}
      <ReportProblem lessonId={lesson.id} />
    </Screen>
  );
}
