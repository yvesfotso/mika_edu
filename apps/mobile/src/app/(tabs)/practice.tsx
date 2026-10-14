import { localize, type DashboardDto, type MistakeDto, type MistakeStatus } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { subjectIcon, TileIcon } from "@/components/dashboard/tile-icon";
import { FeedbackCard, QuestionInput } from "@/components/learning";
import { Button, OfflineNotice, Screen, StateView, T } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { errorMessage } from "@/lib/api";
import { notify } from "@/lib/dialog";
import type { MessageKey } from "@/lib/i18n";
import { reviewMistake, startQuiz } from "@/lib/learning";
import { toneFor, useColors, type TileTone } from "@/lib/theme";
import { useSession } from "@/providers/session";

type Filter = "open" | "recovered" | "all";

const STATUS: Record<MistakeStatus, { label: MessageKey; tone: TileTone }> = {
  open: { label: "statusOpen", tone: "peach" },
  reviewed: { label: "statusReviewed", tone: "lemon" },
  recovered: { label: "statusRecovered", tone: "mint" },
};

function MistakeCard({ m, onChanged }: { m: MistakeDto; onChanged: () => void }) {
  const c = useColors();
  const { t, locale, userId } = useSession();
  const [open, setOpen] = useState(m.status === "open");
  const [busy, setBusy] = useState<string | null>(null);
  const look = STATUS[m.status];
  const date = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });

  async function understood() {
    setBusy("review");
    try {
      await reviewMistake(m.id);
      onChanged();
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setBusy(null);
    }
  }

  async function tryAnother() {
    if (!userId) return;
    setBusy("retry");
    try {
      const scope = m.skill.id ? { skillId: m.skill.id } : { chapterId: m.chapter.id };
      const attemptId = await startQuiz(userId, { ...scope, excludeQuestionIds: [m.question.id] }, "recovery", 2);
      router.push(`/quiz/${attemptId}`);
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 16, gap: 12 }}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <View style={{ backgroundColor: c.tiles[look.tone].bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11.5, fontWeight: "700", color: c.tiles[look.tone].ink }}>{t(look.label)}</Text>
          </View>
          <T variant="small" style={{ flex: 1 }} numberOfLines={1}>
            {localize(m.skill.name, locale)} · {localize(m.chapter.title, locale)}
          </T>
          <T variant="small">{date.format(new Date(m.createdAt))}</T>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <Text style={{ flex: 1, fontSize: 15.5, fontWeight: "700", color: c.text, lineHeight: 22 }}>{localize(m.question.prompt, locale)}</Text>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={c.muted} />
        </View>
      </Pressable>

      {open && (
        <View style={{ gap: 12 }}>
          <T variant="small">{t("yourAnswer")}</T>
          <QuestionInput question={m.question} value={m.response} onChange={() => undefined} result={{ correctOptionIds: m.correctOptionIds }} />
          <FeedbackCard
            question={m.question}
            result={{ correct: false, correctOptionIds: m.correctOptionIds, correctNumericValue: m.correctNumericValue, explanation: m.explanation, misconception: m.misconception }}
          />
          {m.questionUpdated && <T variant="small">{t("questionUpdated")}</T>}
          {m.retriedCorrectAt && !m.recoveredAt && <T variant="small">{t("retriedSame")}</T>}
          {m.recoveredAt && <T variant="small">{t("recoveredOn", { date: date.format(new Date(m.recoveredAt)) })}</T>}
          <View style={{ gap: 8 }}>
            {m.status === "open" && <Button title={t("iUnderstand")} variant="secondary" icon="checkmark" loading={busy === "review"} onPress={understood} />}
            {m.lesson && (
              <Button
                title={t("rereadLesson")}
                variant="secondary"
                icon="book-outline"
                onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: m.lesson!.id, block: String(m.lesson!.block) } })}
              />
            )}
            {m.status !== "recovered" &&
              (m.canRetry ? (
                <Button title={t("tryAnother")} variant="dark" icon="refresh" loading={busy === "retry"} onPress={tryAnother} />
              ) : (
                <T variant="small">{t("noOtherQuestion")}</T>
              ))}
          </View>
        </View>
      )}
    </View>
  );
}

function FilterPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: selected ? c.strong : c.card }}
    >
      <Text style={{ fontWeight: "700", fontSize: 13, color: selected ? c.strongText : c.text }}>{label}</Text>
    </Pressable>
  );
}

export default function Practice() {
  const c = useColors();
  const { t, locale } = useSession();
  const params = useLocalSearchParams<{ chapterId?: string }>();
  const [filter, setFilter] = useState<Filter>("open");
  const [chapterId, setChapterId] = useState<string | undefined>(params.chapterId);
  const query = `/me/mistakes?status=${filter}${chapterId ? `&chapterId=${chapterId}` : ""}`;
  const notebook = useApi<{ mistakes: MistakeDto[]; counts: Record<MistakeStatus, number> }>(query);
  const dashboard = useApi<DashboardDto>("/me/dashboard");

  if (!notebook.data) return <StateView loading={notebook.loading || !notebook.error} error={notebook.error} onRetry={notebook.refresh} />;
  const { mistakes, counts } = notebook.data;
  const subjects = (dashboard.data?.subjects ?? []).filter((s) => s.chapterCount > 0);
  const chapterTitle = chapterId ? mistakes[0]?.chapter.title : null;

  return (
    <Screen refreshing={notebook.loading} onRefresh={notebook.refresh} maxWidth={820}>
      <OfflineNotice visible={notebook.offline} />
      <T variant="title">{t("tabPractice")}</T>

      <View style={{ gap: 6 }}>
        <T variant="heading">{t("mistakeNotebook")}</T>
        <T variant="muted">{t("notebookIntro")}</T>
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }} accessibilityRole="tablist">
        <FilterPill label={`${t("filterToReview")} · ${counts.open + counts.reviewed}`} selected={filter === "open"} onPress={() => setFilter("open")} />
        <FilterPill label={`${t("filterRecovered")} · ${counts.recovered}`} selected={filter === "recovered"} onPress={() => setFilter("recovered")} />
        <FilterPill label={t("filterAll")} selected={filter === "all"} onPress={() => setFilter("all")} />
        {chapterId && (
          <Pressable onPress={() => setChapterId(undefined)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: c.tiles.sky.bg }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: c.tiles.sky.ink }}>{chapterTitle ? localize(chapterTitle, locale) : "…"}</Text>
            <Ionicons name="close" size={14} color={c.tiles.sky.ink} />
          </Pressable>
        )}
      </View>

      {mistakes.length === 0 ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18 }}>
          <T variant="muted">{t("noMistakes")}</T>
        </View>
      ) : (
        mistakes.map((m) => <MistakeCard key={m.id} m={m} onChanged={notebook.refresh} />)
      )}

      {subjects.length > 0 && (
        <View style={{ gap: 10, marginTop: 8 }}>
          <T variant="heading">{t("practiseByChapter")}</T>
          {subjects.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/subject/${s.id}`)}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderRadius: 18, padding: 12 }}
            >
              <TileIcon name={subjectIcon(s.icon)} tone={toneFor(s.id)} size={38} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: "600" }}>{localize(s.name, locale)}</T>
                <T variant="small">
                  {t("skillsMastered", {
                    n: s.skillTotals.mastered,
                    total: Object.values(s.skillTotals).reduce((a, b) => a + b, 0),
                  })}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
