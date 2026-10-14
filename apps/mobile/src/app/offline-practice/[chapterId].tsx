import { localize, type AnswerInputDto, type CheckpointResultDto, type PackQuestionDto } from "@eduprep/core";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { AskCard } from "@/components/learning";
import { Button, Screen, StateView, T } from "@/components/ui";
import { api, NetworkError } from "@/lib/api";
import { randomId } from "@/lib/ids";
import { getPack, markOffline } from "@/lib/packs";
import { enqueue } from "@/lib/sync";
import { useSession } from "@/providers/session";

const SESSION_SIZE = 5;

/** Practice from a downloaded pack: marked on the device, then synced (once) to the learner's record. */
export default function OfflinePractice() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const { t, locale, userId } = useSession();
  const pack = useMemo(() => (userId && chapterId ? getPack(userId, chapterId) : null), [userId, chapterId]);
  // Chosen once per session: a new order on every render would swap the question mid-answer.
  const [questions] = useState<PackQuestionDto[]>(() => {
    const pool = pack ? pack.questions.filter((q) => q.purpose === "practice") : [];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    return pool.slice(0, SESSION_SIZE);
  });
  const [startedAt] = useState(() => new Date().toISOString());
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerInputDto[]>([]);
  const [results, setResults] = useState<Record<string, CheckpointResultDto>>({});
  const [outcome, setOutcome] = useState<"synced" | "queued" | null>(null);
  const clientAttemptId = useRef(randomId());

  if (!pack || questions.length === 0) return <StateView error={t("noDownloads")} />;
  const q = questions[index]!;
  const result = results[q.id] ?? null;
  const finished = answers.length === questions.length && index === questions.length - 1 && result;

  async function finish() {
    if (!userId || outcome) return;
    const body = {
      clientAttemptId: clientAttemptId.current,
      mode: "practice",
      chapterId,
      packVersion: pack!.version,
      questions: questions.map((x) => ({ questionId: x.id, version: x.version })),
      answers,
      startedAt,
      submittedAt: new Date().toISOString(),
    };
    try {
      await api.post("/offline-attempts", body);
      setOutcome("synced");
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err;
      enqueue(userId, "/offline-attempts", body);
      setOutcome("queued");
    }
  }

  const right = Object.values(results).filter((r) => r.correct).length;
  return (
    <Screen edges={["left", "right", "bottom"]} maxWidth={760}>
      <Stack.Screen options={{ title: t("offlinePractice") }} />
      <T variant="small">
        {localize(pack.title, locale)} · {t("question", { i: index + 1, n: questions.length })}
      </T>
      <AskCard
        key={q.id}
        question={q}
        result={result}
        onCheck={(a) => {
          const answer: AnswerInputDto = { questionId: q.id, ...a, answeredAt: new Date().toISOString() };
          setAnswers((prev) => [...prev, answer]);
          setResults((prev) => ({ ...prev, [q.id]: markOffline(q, answer) }));
        }}
        note={result ? t("checkedOffline") : undefined}
      />
      {result && !finished && <Button title={t("next")} variant="dark" onPress={() => setIndex((i) => i + 1)} />}
      {finished && !outcome && <Button title={t("finish")} icon="checkmark-done" onPress={() => void finish()} />}
      {outcome && (
        <>
          <T variant="heading">{t("sessionDone", { ok: right, n: questions.length })}</T>
          <T variant="muted">{outcome === "queued" ? t("sessionQueued") : t("sessionSynced")}</T>
          <Button title={t("backHome")} variant="dark" onPress={() => router.replace("/(tabs)")} />
        </>
      )}
    </Screen>
  );
}
