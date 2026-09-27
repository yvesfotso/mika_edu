import { localize, type AnswerInputDto, type AttemptQuestionDto, type AttemptResultDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { Badge, Button, OfflineNotice, Row, Screen, StateView, T } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, cacheKey, NetworkError } from "@/lib/api";
import { confirm, notify } from "@/lib/dialog";
import { formatDuration, type AttemptView } from "@/lib/learning";
import { store } from "@/lib/storage";
import { enqueue } from "@/lib/sync";
import { radius, spacing, useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

type Answers = Record<string, AnswerInputDto>;

function OptionButton({
  label,
  letter,
  selected,
  multiple,
  onPress,
}: {
  label: string;
  letter: string;
  selected: boolean;
  multiple: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: 14,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: selected ? c.text : "transparent",
        backgroundColor: selected ? c.primarySoft : c.card,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: multiple ? 10 : 17,
          backgroundColor: selected ? c.strong : c.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && multiple ? (
          <Ionicons name="checkmark" size={18} color={c.primary} />
        ) : (
          <Text style={{ fontWeight: "800", color: selected ? c.primary : c.text }}>{letter}</Text>
        )}
      </View>
      <T style={{ flex: 1, fontWeight: selected ? "600" : "400" }}>{label}</T>
    </Pressable>
  );
}

function QuestionView({
  question,
  answer,
  onChange,
}: {
  question: AttemptQuestionDto;
  answer: AnswerInputDto | undefined;
  onChange: (patch: Omit<AnswerInputDto, "questionId">) => void;
}) {
  const c = useColors();
  const { t, locale } = useSession();
  const [numericText, setNumericText] = useState(answer?.numericValue !== undefined ? String(answer.numericValue) : "");
  const selected = answer?.selectedOptionIds ?? [];
  const multiple = question.type === "multiple_choice";

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ backgroundColor: c.card, borderRadius: radius.lg, padding: 20, gap: 10 }}>
        <Row style={{ flexWrap: "wrap" }}>
          {question.sourceType === "official_past_paper" && question.sourceYear && (
            <Badge label={t("pastPaperLabel", { year: question.sourceYear })} tone="sky" />
          )}
          {question.sourceType === "ai_generated" && <Badge label={t("aiGenerated")} tone="lemon" />}
          {multiple && <Badge label={t("selectAll")} tone="lavender" />}
        </Row>
        <Text style={{ fontSize: 20, fontWeight: "700", lineHeight: 28, color: c.text, letterSpacing: -0.3 }}>{localize(question.prompt, locale)}</Text>
      </View>

      {question.type === "numeric" ? (
        <TextInput
          value={numericText}
          onChangeText={(text) => {
            setNumericText(text);
            const value = Number(text.replace(",", ".").trim());
            onChange(text.trim() === "" || !Number.isFinite(value) ? {} : { numericValue: value });
          }}
          keyboardType="numbers-and-punctuation"
          placeholder={t("enterNumber")}
          placeholderTextColor={c.muted}
          accessibilityLabel={t("yourAnswer")}
          style={[
            {
              borderWidth: 2,
              borderColor: numericText ? c.text : "transparent",
              borderRadius: radius.lg,
              padding: 18,
              fontSize: 22,
              fontWeight: "700",
              color: c.text,
              backgroundColor: c.card,
            },
            Platform.OS === "web" && ({ outlineStyle: "none" } as object),
          ]}
        />
      ) : (
        question.options.map((o, i) => (
          <OptionButton
            key={o.id}
            letter={String.fromCharCode(65 + i)}
            label={localize(o.text, locale)}
            multiple={multiple}
            selected={selected.includes(o.id)}
            onPress={() => {
              const next = multiple
                ? selected.includes(o.id)
                  ? selected.filter((id) => id !== o.id)
                  : [...selected, o.id]
                : [o.id];
              onChange({ selectedOptionIds: next });
            }}
          />
        ))
      )}
    </View>
  );
}

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { t, userId } = useSession();
  const path = id ? `/quiz-attempts/${id}` : null;
  const { data, error, loading, offline, refresh } = useApi<AttemptView>(path);
  const localKey = `quiz:${id}:answers`;

  const [localAnswers, setAnswers] = useState<Answers>(() => store.get<Answers>(localKey) ?? {});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const shownAt = useRef(0);
  const submittedRef = useRef(false);

  const attempt = data?.attempt;
  const deadline = attempt?.deadlineAt ? new Date(attempt.deadlineAt).getTime() : null;

  // Server-autosaved answers (e.g. resuming on another device) under the ones given on this phone.
  const answers = useMemo<Answers>(
    () => ({ ...Object.fromEntries((attempt?.savedAnswers ?? []).map((a) => [a.questionId, a])), ...localAnswers }),
    [attempt, localAnswers],
  );

  useEffect(() => {
    store.set(localKey, localAnswers);
  }, [localAnswers, localKey]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  // Mock exams autosave to the server so answers count even if the phone dies before submitting.
  useEffect(() => {
    if (!deadline || !id) return;
    const list = Object.values(answers);
    if (list.length === 0) return;
    const handle = setTimeout(() => {
      api.post(`/quiz-attempts/${id}/answers`, { answers: list }).catch(() => undefined);
    }, 2000);
    return () => clearTimeout(handle);
  }, [answers, deadline, id]);

  const submit = useCallback(async () => {
    if (!attempt || !userId || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const body = { answers: Object.values(answers) };
    try {
      const { result } = await api.post<{ result: AttemptResultDto }>(`/quiz-attempts/${attempt.id}/submit`, body);
      store.set(cacheKey(userId, `/quiz-attempts/${attempt.id}`), { attempt: { ...attempt, submittedAt: result.submittedAt }, result });
      store.remove(localKey);
      router.replace(`/results/${attempt.id}`);
    } catch (err) {
      if (err instanceof NetworkError) {
        enqueue(userId, `/quiz-attempts/${attempt.id}/submit`, body);
        store.remove(localKey);
        notify(t("submittedOffline"));
        router.replace(`/results/${attempt.id}`);
      } else {
        submittedRef.current = false;
        notify(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSubmitting(false);
    }
  }, [answers, attempt, localKey, t, userId]);

  const remainingMs = deadline ? deadline - now : null;
  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0 && !submittedRef.current) void submit();
  }, [remainingMs, submit]);

  if (data?.result) return <Redirect href={`/results/${data.attempt.id}`} />;
  if (!attempt) return <StateView loading={loading || !error} error={error} onRetry={refresh} />;

  const questions = attempt.questions;
  const question = questions[index];
  if (!question) return <StateView error={t("offlineNoData")} />;
  const isLast = index === questions.length - 1;
  const unanswered = questions.filter((q) => {
    const a = answers[q.id];
    return !a || (a.numericValue === undefined && !(a.selectedOptionIds?.length ?? 0));
  }).length;

  function setAnswer(patch: Omit<AnswerInputDto, "questionId">) {
    const elapsed = Date.now() - shownAt.current;
    setAnswers((prev) => ({
      ...prev,
      [question!.id]: { questionId: question!.id, ...patch, responseMs: Math.min(elapsed, 3 * 60 * 60 * 1000) },
    }));
  }

  async function confirmSubmit() {
    const ok =
      unanswered === 0 ||
      (await confirm(t("submitConfirm"), t("unanswered", { n: unanswered }), { ok: t("submit"), cancel: t("cancel") }));
    if (ok) void submit();
  }

  const isAnswered = (qid: string) => {
    const a = answers[qid];
    return Boolean(a && (a.numericValue !== undefined || (a.selectedOptionIds?.length ?? 0) > 0));
  };
  const urgent = remainingMs !== null && remainingMs < 60_000;

  return (
    <Screen edges={["left", "right", "bottom"]} maxWidth={760}>
      <Stack.Screen options={{ title: t("question", { i: index + 1, n: questions.length }) }} />
      <OfflineNotice visible={offline} />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 5, flex: 1, flexWrap: "wrap" }}>
          {questions.map((q, i) => (
            <Pressable
              key={q.id}
              onPress={() => setIndex(i)}
              accessibilityRole="button"
              accessibilityLabel={t("question", { i: i + 1, n: questions.length })}
              hitSlop={4}
              style={{
                flexGrow: 1,
                minWidth: 14,
                maxWidth: 48,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? c.primary : isAnswered(q.id) ? c.strong : c.track,
              }}
            />
          ))}
        </View>
        {remainingMs !== null && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: urgent ? c.danger : c.strong,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
            accessibilityLiveRegion="polite"
          >
            <Ionicons name="timer-outline" size={15} color={urgent ? "#FFFFFF" : c.primary} />
            <Text style={{ color: urgent ? "#FFFFFF" : c.primary, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
              {formatDuration(Math.max(0, remainingMs) / 1000)}
            </Text>
          </View>
        )}
      </View>
      {remainingMs !== null && remainingMs <= 0 && <T style={{ color: c.danger }}>{t("timeUp")}</T>}

      <QuestionView key={question.id} question={question} answer={answers[question.id]} onChange={setAnswer} />

      <Row style={{ gap: spacing.md, marginTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button title={t("previous")} variant="light" icon="arrow-back" disabled={index === 0} onPress={() => setIndex((i) => i - 1)} />
        </View>
        <View style={{ flex: 1 }}>
          {isLast ? (
            <Button title={t("submit")} icon="checkmark-done" loading={submitting} onPress={confirmSubmit} />
          ) : (
            <Button title={t("next")} variant="dark" onPress={() => setIndex((i) => i + 1)} />
          )}
        </View>
      </Row>
    </Screen>
  );
}
