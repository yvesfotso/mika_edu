import { localize, type StudyTaskDto, type TodayPlanDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { T } from "@/components/ui";
import type { MessageKey } from "@/lib/i18n";
import { useColors, type TileTone } from "@/lib/theme";
import { useSession } from "@/providers/session";
import { TileIcon } from "./tile-icon";

type IconName = ComponentProps<typeof Ionicons>["name"];

const KIND_LOOK: Record<StudyTaskDto["kind"], { icon: IconName; tone: TileTone }> = {
  diagnostic: { icon: "compass-outline", tone: "sky" },
  continue_lesson: { icon: "play-outline", tone: "lavender" },
  recover_mistakes: { icon: "refresh-outline", tone: "peach" },
  review_skill: { icon: "repeat-outline", tone: "lemon" },
  next_lesson: { icon: "book-outline", tone: "lavender" },
  practice_chapter: { icon: "flash-outline", tone: "mint" },
};

const REASON_KEY: Record<StudyTaskDto["reason"]["code"], MessageKey> = {
  diagnostic: "reasonDiagnostic",
  unfinished: "reasonUnfinished",
  recent_mistakes: "reasonRecent",
  needs_review: "reasonNeedsReview",
  next_in_order: "reasonNextInOrder",
  weak: "reasonWeak",
  forgetting: "reasonForgetting",
  not_started: "reasonNotStarted",
};

/** The task's own words: what it is and why it's here today. */
export function useTaskText() {
  const { t, locale } = useSession();
  return (task: StudyTaskDto) => {
    const title = task.title ? localize(task.title, locale) : "";
    const label =
      task.kind === "diagnostic"
        ? t("taskDiagnostic")
        : task.kind === "recover_mistakes"
          ? t("taskRecover", { skill: title })
          : task.kind === "review_skill"
            ? t("taskReview", { skill: title })
            : task.kind === "practice_chapter"
              ? t("practiceChapter")
              : title;
    const r = task.reason;
    const reason =
      r.code === "unfinished"
        ? t("reasonUnfinished", { i: r.block ?? 1, n: r.blocks ?? 1 })
        : r.code === "recent_mistakes"
          ? t("reasonRecent", { n: r.count ?? 1 })
          : r.code === "next_in_order"
            ? t("reasonNextInOrder", { chapter: task.chapterTitle ? localize(task.chapterTitle, locale) : "" })
            : t(REASON_KEY[r.code]);
    return { label, reason };
  };
}

export function TaskRow({ task, busy, onPress }: { task: StudyTaskDto; busy: boolean; onPress: () => void }) {
  const c = useColors();
  const { t } = useSession();
  const text = useTaskText();
  const { label, reason } = text(task);
  const look = KIND_LOOK[task.kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${reason}. ${t("minutes", { n: task.minutes })}`}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}
    >
      <TileIcon name={look.icon} tone={look.tone} size={38} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: c.text }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={2}>
          {reason}
        </Text>
      </View>
      <Text style={{ fontSize: 12, fontWeight: "600", color: c.muted }}>{t("minutes", { n: task.minutes })}</Text>
      {busy ? (
        <ActivityIndicator color={c.text} />
      ) : (
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-forward" size={14} color={c.text} />
        </View>
      )}
    </Pressable>
  );
}

/** Today's plan: one clear next action, then the rest of the session. */
export function TodayPlanPanel({ plan, busy, onStart }: { plan: TodayPlanDto; busy: string | null; onStart: (task: StudyTaskDto) => void }) {
  const c = useColors();
  const { t, locale } = useSession();
  const [first, ...rest] = plan.tasks;
  const text = useTaskText();

  return (
    <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <T variant="heading">{t("todaysPlan")}</T>
        <Text style={{ fontSize: 12.5, color: c.muted }}>{t("sessionPlan", { n: plan.plannedMinutes || plan.sessionMinutes })}</Text>
      </View>
      {!plan.studyDay && <T variant="small">{t("restDay")}</T>}

      {!first ? (
        <T variant="muted">{plan.doneToday.length > 0 ? t("allDone") : t("noPlan")}</T>
      ) : (
        <>
          <Pressable
            onPress={() => onStart(first)}
            disabled={busy === first.id}
            accessibilityRole="button"
            style={({ pressed }) => ({ backgroundColor: c.primary, borderRadius: 18, padding: 16, gap: 6, opacity: pressed ? 0.9 : 1 })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="play" size={16} color={c.primaryText} />
              <Text style={{ flex: 1, fontSize: 15.5, fontWeight: "800", color: c.primaryText }}>{t("startSession")}</Text>
              {busy === first.id && <ActivityIndicator color={c.primaryText} />}
            </View>
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: c.primaryText }} numberOfLines={1}>
              {text(first).label} · {t("minutes", { n: first.minutes })}
            </Text>
            <Text style={{ fontSize: 12.5, color: c.primaryText, opacity: 0.75 }} numberOfLines={2}>
              {text(first).reason}
            </Text>
          </Pressable>
          {rest.map((task) => (
            <TaskRow key={task.id} task={task} busy={busy === task.id} onPress={() => onStart(task)} />
          ))}
        </>
      )}

      {plan.doneToday.length > 0 && (
        <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
          <T variant="small" style={{ fontWeight: "700" }}>
            {t("doneTodayTitle")}
          </T>
          {plan.doneToday.slice(0, 3).map((d, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="checkmark-circle" size={14} color={c.success} />
              <T variant="small" numberOfLines={1}>
                {d.title ? localize(d.title, locale) : t(KIND_TITLE[d.kind])}
              </T>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const KIND_TITLE: Record<StudyTaskDto["kind"], MessageKey> = {
  diagnostic: "diagnosticTitle",
  continue_lesson: "continueStudying",
  recover_mistakes: "reviewMistakes",
  review_skill: "modeRecovery",
  next_lesson: "lessons",
  practice_chapter: "practice",
};
