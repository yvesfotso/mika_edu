import { localize, type AttemptQuestionDto, type QuestionResultDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Panel } from "@/components/dashboard/sections";
import { TileIcon } from "@/components/dashboard/tile-icon";
import { Button, pct, ProgressBar, Screen, StateView, T } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { errorMessage } from "@/lib/api";
import { notify } from "@/lib/dialog";
import { formatDuration, startQuiz, type AttemptView } from "@/lib/learning";
import { useColors, type TileTone } from "@/lib/theme";
import { useSession } from "@/providers/session";

function ScoreRing({ value, color, track }: { value: number; color: string; track: string }) {
  const size = 116;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, value)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function ReviewItem({ n, question, result }: { n: number; question: AttemptQuestionDto; result: QuestionResultDto }) {
  const c = useColors();
  const { t, locale } = useSession();
  const status = !result.answered ? "skipped" : result.correct ? "correct" : "incorrect";
  const tone: TileTone = status === "correct" ? "mint" : status === "incorrect" ? "peach" : "lemon";
  const icon = status === "correct" ? "checkmark" : status === "incorrect" ? "close" : "remove";

  const optionText = (ids: string[]) =>
    question.options
      .filter((o) => ids.includes(o.id))
      .map((o) => localize(o.text, locale))
      .join(", ");
  const correctText = question.type === "numeric" ? String(result.correctNumericValue ?? "") : optionText(result.correctOptionIds);
  const givenText =
    question.type === "numeric" ? (result.numericValue !== null ? String(result.numericValue) : "") : optionText(result.selectedOptionIds);
  const explanation = localize(result.explanation, locale);

  return (
    <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TileIcon name={icon} tone={tone} size={32} />
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: c.tiles[tone].ink, flex: 1 }}>
          {n}. {t(status)}
        </Text>
      </View>
      <T style={{ fontWeight: "600" }}>{localize(question.prompt, locale)}</T>
      {result.answered && !result.correct && (
        <T variant="muted">
          {t("yourAnswer")}: {givenText}
        </T>
      )}
      {!result.correct && (
        <View style={{ backgroundColor: c.tiles.mint.bg, borderRadius: 14, padding: 12 }}>
          <Text style={{ color: c.tiles.mint.ink, fontWeight: "700" }}>{t("correctAnswer", { a: correctText })}</Text>
        </View>
      )}
      {explanation !== "" && (
        <View style={{ backgroundColor: c.tiles.lavender.bg, borderRadius: 14, padding: 12, gap: 4 }}>
          <Text style={{ fontSize: 12, color: c.tiles.lavender.ink, fontWeight: "700" }}>{t("explanation")}</Text>
          <T>{explanation}</T>
        </View>
      )}
    </View>
  );
}

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { t, locale, userId } = useSession();
  const { width } = useWindowDimensions();
  const { data, error, loading, refresh } = useApi<AttemptView>(id ? `/quiz-attempts/${id}` : null);
  const [starting, setStarting] = useState(false);

  if (!data) return <StateView loading={loading || !error} error={error} onRetry={refresh} />;
  const { attempt, result } = data;

  if (!result) {
    return (
      <Screen maxWidth={640}>
        <Stack.Screen options={{ title: t("results") }} />
        <StateView error={t("resultsPending")} onRetry={refresh} />
        <Button title={t("backHome")} variant="light" onPress={() => router.replace("/(tabs)")} />
      </Screen>
    );
  }

  const byId = new Map(result.results.map((r) => [r.questionId, r]));
  const ratio = result.maxScore ? result.score / result.maxScore : 0;
  const scoreColor = result.percentage >= 70 ? c.primary : result.percentage >= 50 ? c.tiles.lemon.ink : c.tiles.peach.ink;
  const verdict = result.percentage >= 70 ? t("scoreGreat") : result.percentage >= 50 ? t("scoreGood") : t("scoreReview");
  const wide = width >= 900;

  async function again() {
    if (!userId) return;
    setStarting(true);
    try {
      const scope = attempt.chapterId ? { chapterId: attempt.chapterId } : { subjectId: attempt.subjectId ?? undefined };
      const next = await startQuiz(userId, scope, attempt.mode);
      router.replace(`/quiz/${next}`);
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setStarting(false);
    }
  }

  const summary = (
    <View style={{ gap: 16 }}>
      <View style={{ backgroundColor: c.strong, borderRadius: 22, padding: 22, flexDirection: "row", alignItems: "center", gap: 20, overflow: "hidden" }}>
        <View style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: c.strongRaised }} />
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <ScoreRing value={ratio} color={scoreColor} track={c.strongRaised} />
          <View style={{ position: "absolute", alignItems: "center" }}>
            <Text style={{ color: c.strongText, fontSize: 26, fontWeight: "800" }}>
              {result.score}/{result.maxScore}
            </Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: c.strongMuted, fontSize: 13 }}>{t("score")}</Text>
          <Text style={{ color: scoreColor, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 }}>{Math.round(result.percentage)}%</Text>
          <Text style={{ color: c.strongText, fontSize: 15, fontWeight: "600" }}>{verdict}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Ionicons name="time-outline" size={14} color={c.strongMuted} />
            <Text style={{ color: c.strongMuted, fontSize: 13 }}>
              {t("time")} {formatDuration(result.durationSeconds)}
            </Text>
          </View>
        </View>
      </View>

      {result.chapterBreakdown.length > 0 && (
        <Panel title={t("byChapter")}>
          {result.chapterBreakdown.map((b) => {
            const mastery = result.masteryAfter.find((m) => m.chapterId === b.chapterId)?.mastery;
            return (
              <View key={b.chapterId} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <T style={{ flex: 1, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                    {localize(b.title, locale)}
                  </T>
                  <T variant="small">
                    {b.correct}/{b.total}
                  </T>
                </View>
                {mastery !== undefined && (
                  <>
                    <ProgressBar value={mastery} />
                    <T variant="small">
                      {t("mastery")} {pct(mastery)}
                    </T>
                  </>
                )}
              </View>
            );
          })}
        </Panel>
      )}

      <Button title={t("practiceAgain")} icon="refresh" loading={starting} onPress={again} />
      <Button title={t("backHome")} variant="dark" onPress={() => router.replace("/(tabs)")} />
    </View>
  );

  const review = (
    <View style={{ gap: 12 }}>
      <T variant="heading">{t("review")}</T>
      {attempt.questions.map((q, i) => {
        const r = byId.get(q.id);
        return r ? <ReviewItem key={q.id} n={i + 1} question={q} result={r} /> : null;
      })}
    </View>
  );

  return (
    <Screen edges={["left", "right", "bottom"]} maxWidth={1060}>
      <Stack.Screen options={{ title: t("results") }} />
      {wide ? (
        <View style={{ flexDirection: "row", gap: 22, alignItems: "flex-start" }}>
          <View style={{ width: 400 }}>{summary}</View>
          <View style={{ flex: 1 }}>{review}</View>
        </View>
      ) : (
        <>
          {summary}
          {review}
        </>
      )}
    </Screen>
  );
}
