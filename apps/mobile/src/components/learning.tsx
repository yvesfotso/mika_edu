import {
  CONTENT_REPORT_REASONS,
  localize,
  MASTERY_RULES,
  type AnswerInputDto,
  type AttemptQuestionDto,
  type LocalizedText,
  type SkillProgressDto,
  type SkillStatus,
} from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { MarkdownView } from "@/components/markdown-view";
import { Button, T } from "@/components/ui";
import { NetworkError } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n";
import { reportContent } from "@/lib/learning";
import { radius, spacing, useColors, type TileTone } from "@/lib/theme";
import { useSession } from "@/providers/session";

// ---------------------------------------------------------------------------
// Skill status
// ---------------------------------------------------------------------------

export const STATUS_LOOK: Record<SkillStatus, { label: MessageKey; tone: TileTone; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  not_assessed: { label: "statusNotAssessed", tone: "sky", icon: "ellipse-outline" },
  learning: { label: "statusLearning", tone: "lemon", icon: "trending-up-outline" },
  needs_review: { label: "statusNeedsReview", tone: "peach", icon: "refresh-outline" },
  mastered: { label: "statusMastered", tone: "mint", icon: "checkmark-circle-outline" },
};

/** Status with an icon and a word, never colour alone. */
export function StatusChip({ status }: { status: SkillStatus }) {
  const c = useColors();
  const { t } = useSession();
  const look = STATUS_LOOK[status];
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: c.tiles[look.tone].bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}
    >
      <Ionicons name={look.icon} size={13} color={c.tiles[look.tone].ink} />
      <Text style={{ fontSize: 11.5, fontWeight: "700", color: c.tiles[look.tone].ink }}>{t(look.label)}</Text>
    </View>
  );
}

/** One sentence explaining why a skill has its status. */
export function useSkillWhy() {
  const { t } = useSession();
  return (s: SkillProgressDto): string => {
    const e = s.evidence;
    const base = (() => {
      switch (s.reason) {
        case "no_evidence":
          return t("whyNoEvidence");
        case "not_enough_questions":
          return t("whyNotEnough");
        case "needs_more_correct":
          return t("whyNeedsMore", { n: e.distinctCorrect, need: s.required.distinctCorrect });
        case "needs_more_sessions":
          return t("whyNeedsSessions", { n: e.sessions, need: s.required.sessions });
        case "recent_error":
          return t("whyRecentError", { n: MASTERY_RULES.correctToResolveError });
        case "stale":
          return t("whyStale");
        case "mastered":
          return t("whyMastered", { n: e.distinctCorrect, d: e.sessions });
      }
    })();
    return e.hintedCorrect > 0 ? `${base} (${t("hintedCount", { n: e.hintedCorrect })})` : base;
  };
}

export function SkillRow({ skill, onPractise }: { skill: SkillProgressDto; onPractise?: () => void }) {
  const c = useColors();
  const { t, locale } = useSession();
  const why = useSkillWhy();
  return (
    <View style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <T style={{ flex: 1, fontSize: 14, fontWeight: "600" }}>{localize(skill.name, locale)}</T>
        <StatusChip status={skill.status} />
      </View>
      <T variant="small">{why(skill)}</T>
      {onPractise && skill.questionCount > 0 && (
        <Pressable onPress={onPractise} accessibilityRole="button" hitSlop={6} style={{ alignSelf: "flex-start" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: c.text, textDecorationLine: "underline" }}>{t("practiseSkill")}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

type Answer = Omit<AnswerInputDto, "questionId">;

export function isAnswerGiven(a: Answer | undefined): boolean {
  return Boolean(a && (a.numericValue !== undefined || (a.selectedOptionIds?.length ?? 0) > 0));
}

/** Options or a numeric field. `result` locks the input and colours the right/wrong choices. */
export function QuestionInput({
  question,
  value,
  onChange,
  result,
}: {
  question: AttemptQuestionDto;
  value: Answer;
  onChange: (next: Answer) => void;
  result?: { correctOptionIds: string[] } | null;
}) {
  const c = useColors();
  const { t, locale } = useSession();
  const [text, setText] = useState(value.numericValue !== undefined ? String(value.numericValue) : "");
  const selected = value.selectedOptionIds ?? [];
  const multiple = question.type === "multiple_choice";
  const locked = Boolean(result);

  if (question.type === "numeric") {
    return (
      <TextInput
        value={text}
        editable={!locked}
        onChangeText={(next) => {
          setText(next);
          const n = Number(next.replace(",", ".").trim());
          onChange(next.trim() === "" || !Number.isFinite(n) ? {} : { numericValue: n });
        }}
        keyboardType="numbers-and-punctuation"
        placeholder={t("enterNumber")}
        placeholderTextColor={c.muted}
        accessibilityLabel={t("yourAnswer")}
        style={[
          { borderWidth: 2, borderColor: text ? c.text : c.border, borderRadius: radius.md, padding: 14, fontSize: 18, fontWeight: "700", color: c.text, backgroundColor: c.card },
          Platform.OS === "web" && ({ outlineStyle: "none" } as object),
        ]}
      />
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {question.options.map((o, i) => {
        const isSelected = selected.includes(o.id);
        const isRight = result?.correctOptionIds.includes(o.id);
        const border = result ? (isRight ? c.success : isSelected ? c.danger : "transparent") : isSelected ? c.text : "transparent";
        return (
          <Pressable
            key={o.id}
            disabled={locked}
            onPress={() =>
              onChange({ selectedOptionIds: multiple ? (isSelected ? selected.filter((id) => id !== o.id) : [...selected, o.id]) : [o.id] })
            }
            accessibilityRole={multiple ? "checkbox" : "radio"}
            accessibilityState={{ checked: isSelected, disabled: locked }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: 12,
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: border,
              backgroundColor: isSelected && !result ? c.primarySoft : c.background,
            }}
          >
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isSelected ? c.strong : c.card, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontWeight: "800", color: isSelected ? c.primary : c.text }}>{String.fromCharCode(65 + i)}</Text>
            </View>
            <T style={{ flex: 1 }}>{localize(o.text, locale)}</T>
            {result && isRight && <Ionicons name="checkmark-circle" size={20} color={c.success} accessibilityLabel={t("correct")} />}
            {result && isSelected && !isRight && <Ionicons name="close-circle" size={20} color={c.danger} accessibilityLabel={t("incorrect")} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Feedback after marking: the reasoning, the authored misconception and where the mistake went. */
export function FeedbackCard({
  question,
  result,
  note,
}: {
  question: AttemptQuestionDto;
  result: { correct: boolean; correctOptionIds: string[]; correctNumericValue: number | null; explanation: LocalizedText; misconception: LocalizedText | null; mistakeId?: string | null };
  note?: string;
}) {
  const c = useColors();
  const { t, locale } = useSession();
  const tone: TileTone = result.correct ? "mint" : "peach";
  const correctText =
    question.type === "numeric"
      ? String(result.correctNumericValue ?? "")
      : question.options
          .filter((o) => result.correctOptionIds.includes(o.id))
          .map((o) => localize(o.text, locale))
          .join(", ");
  const explanation = localize(result.explanation, locale);
  return (
    <View style={{ backgroundColor: c.tiles[tone].bg, borderRadius: radius.md, padding: 14, gap: 8 }} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={result.correct ? "checkmark-circle" : "alert-circle"} size={18} color={c.tiles[tone].ink} />
        <Text style={{ fontWeight: "800", color: c.tiles[tone].ink }}>{result.correct ? t("correctFeedback") : t("incorrectFeedback")}</Text>
      </View>
      {!result.correct && <T style={{ fontWeight: "600" }}>{t("correctAnswer", { a: correctText })}</T>}
      {!result.correct && result.misconception && <T>{t("likelyMistake", { m: localize(result.misconception, locale) })}</T>}
      {explanation !== "" && <MarkdownView source={explanation} />}
      {!result.correct && result.mistakeId && <T variant="small">{t("addedToNotebook")}</T>}
      {note && <T variant="small">{note}</T>}
    </View>
  );
}

export function HintBox({ hint, shown, onShow }: { hint: LocalizedText | null; shown: boolean; onShow: () => void }) {
  const c = useColors();
  const { t, locale } = useSession();
  if (!hint) return null;
  if (!shown) {
    return (
      <Pressable onPress={onShow} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6 }}>
        <Ionicons name="bulb-outline" size={16} color={c.text} />
        <Text style={{ fontSize: 13.5, fontWeight: "700", color: c.text, textDecorationLine: "underline" }}>{t("showHint")}</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ backgroundColor: c.tiles.lemon.bg, borderRadius: radius.md, padding: 12, gap: 4 }}>
      <Text style={{ fontSize: 12, fontWeight: "800", color: c.tiles.lemon.ink }}>{t("hint")}</Text>
      <T>{localize(hint, locale)}</T>
      <T variant="small">{t("hintNote")}</T>
    </View>
  );
}

const REASON_LABEL: Record<(typeof CONTENT_REPORT_REASONS)[number], MessageKey> = {
  wrong_answer: "reportWrongAnswer",
  unclear: "reportUnclear",
  typo: "reportTypo",
  other: "reportOther",
};

/** "Report a problem" with a reason; needs a connection, and says so when there isn't one. */
export function ReportProblem({ questionId, lessonId }: { questionId?: string; lessonId?: string }) {
  const c = useColors();
  const { t } = useSession();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "offline" | "error">("idle");

  async function send(reason: (typeof CONTENT_REPORT_REASONS)[number]) {
    setState("sending");
    try {
      await reportContent({ questionId, lessonId, reason });
      setState("sent");
    } catch (err) {
      setState(err instanceof NetworkError ? "offline" : "error");
    }
  }

  if (state === "sent") return <T variant="small">{t("reportThanks")}</T>;
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
        <Ionicons name="flag-outline" size={14} color={c.muted} />
        <Text style={{ fontSize: 12.5, color: c.muted, textDecorationLine: "underline" }}>{t("reportProblem")}</Text>
      </Pressable>
      {open && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {CONTENT_REPORT_REASONS.map((r) => (
            <Pressable
              key={r}
              disabled={state === "sending"}
              onPress={() => void send(r)}
              accessibilityRole="button"
              style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: c.background }}
            >
              <Text style={{ fontSize: 12.5, color: c.text, fontWeight: "600" }}>{t(REASON_LABEL[r])}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {state === "offline" && <T variant="small">{t("reportOffline")}</T>}
      {state === "error" && <T variant="small">{t("downloadFailedServer")}</T>}
    </View>
  );
}

/** Ask, check, explain: one question with a hint, used for lesson checkpoints and offline practice. */
export function AskCard({
  question,
  result,
  busy,
  onCheck,
  note,
}: {
  question: AttemptQuestionDto;
  result: Parameters<typeof FeedbackCard>[0]["result"] | null;
  busy?: boolean;
  onCheck: (answer: Answer & { hintsUsed: number; responseMs: number }) => void;
  note?: string;
}) {
  const c = useColors();
  const { t, locale } = useSession();
  const [answer, setAnswer] = useState<Answer>({});
  const [hintShown, setHintShown] = useState(false);
  const [shownAt] = useState(() => Date.now());
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 12 }}>
      <Text style={{ fontSize: 17, fontWeight: "700", color: c.text, lineHeight: 24 }}>{localize(question.prompt, locale)}</Text>
      <QuestionInput question={question} value={answer} onChange={setAnswer} result={result} />
      {!result && <HintBox hint={question.hint} shown={hintShown} onShow={() => setHintShown(true)} />}
      {result ? (
        <FeedbackCard question={question} result={result} note={note} />
      ) : (
        <Button
          title={t("check")}
          variant="dark"
          loading={busy}
          disabled={!isAnswerGiven(answer)}
          onPress={() => onCheck({ ...answer, hintsUsed: hintShown ? 1 : 0, responseMs: Math.min(Date.now() - shownAt, 3 * 60 * 60 * 1000) })}
        />
      )}
      <ReportProblem questionId={question.id} />
    </View>
  );
}
