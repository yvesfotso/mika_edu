import { localize, type Locale, type LocalizedText } from "./i18n";
import { splitLessonBlocks } from "./lessons";
import { groupBySkill } from "./mistakes";
import { practiceCounts, type CurriculumShape } from "./progress";
import { skillKeyFor } from "./skills";
import type { AttemptMode, DiagnosticStatus, SkillProgressDto, StudyTaskDto, StudyTaskKind, TodayPlanDto } from "./types";

/** Estimated minutes per task type; a starting point, not a measurement. */
export const TASK_MINUTES = { diagnostic: 6, recovery: 5, review: 8, practice: 10 } as const;

export interface PlanInput {
  date: string;
  sessionMinutes: number;
  studyDay: boolean;
  diagnosticStatus: DiagnosticStatus;
  /** The diagnostic needs at least one assessable skill in the learner's track. */
  diagnosticAvailable: boolean;
  /** Lessons started (a block or checkpoint saved) but not read to the end. */
  unfinishedLessons: { lessonId: string; title: LocalizedText; chapterId: string; chapterTitle: LocalizedText; minutes: number; block: number; blocks: number }[];
  /** Open mistakes grouped by skill, most recent first; only skills with other questions to try. */
  mistakeSkills: { skillKey: string; skillId: string | null; chapterId: string; chapterTitle: LocalizedText; skillName: LocalizedText; count: number }[];
  /** Skills whose status is needs_review. */
  reviewSkills: { skillKey: string; skillId: string | null; chapterId: string; chapterTitle: LocalizedText; skillName: LocalizedText }[];
  /** Unread lessons in recommended order. */
  nextLessons: { lessonId: string; title: LocalizedText; chapterId: string; chapterTitle: LocalizedText; minutes: number }[];
  /** Chapters to practise, from recommendChapters. */
  practiceChapters: { chapterId: string; chapterTitle: LocalizedText; reason: "weak" | "forgetting" | "not_started" }[];
  doneToday: TodayPlanDto["doneToday"];
  openMistakes: number;
}

/**
 * Builds today's plan, in this order: the diagnostic (if not yet taken), the unfinished lesson,
 * recent mistakes, skills due for review, the next lesson, then chapter practice. Each target appears
 * once, and tasks stop once the learner's session time is used (always at least one task).
 */
export function planToday(input: PlanInput): TodayPlanDto {
  const candidates: StudyTaskDto[] = [];
  const add = (task: StudyTaskDto) => candidates.push(task);

  if (input.diagnosticStatus === "pending" && input.diagnosticAvailable) {
    add({
      id: "diagnostic",
      kind: "diagnostic",
      minutes: TASK_MINUTES.diagnostic,
      title: null,
      chapterTitle: null,
      target: {},
      reason: { code: "diagnostic" },
      completion: "diagnostic_done",
    });
  }

  for (const l of input.unfinishedLessons.slice(0, 1)) {
    add({
      id: `lesson:${l.lessonId}`,
      kind: "continue_lesson",
      minutes: Math.max(3, Math.round(l.minutes * (1 - l.block / Math.max(1, l.blocks)))),
      title: l.title,
      chapterTitle: l.chapterTitle,
      target: { lessonId: l.lessonId, chapterId: l.chapterId },
      reason: { code: "unfinished", block: l.block + 1, blocks: l.blocks },
      completion: "lesson_read",
    });
  }

  for (const m of input.mistakeSkills.slice(0, 2)) {
    add({
      id: `recover:${m.skillKey}`,
      kind: "recover_mistakes",
      minutes: TASK_MINUTES.recovery,
      title: m.skillName,
      chapterTitle: m.chapterTitle,
      target: { chapterId: m.chapterId, ...(m.skillId ? { skillId: m.skillId } : {}) },
      reason: { code: "recent_mistakes", count: m.count, skillName: m.skillName },
      completion: "recovery_attempt",
    });
  }

  for (const r of input.reviewSkills.slice(0, 1)) {
    add({
      id: `review:${r.skillKey}`,
      kind: "review_skill",
      minutes: TASK_MINUTES.review,
      title: r.skillName,
      chapterTitle: r.chapterTitle,
      target: { chapterId: r.chapterId, ...(r.skillId ? { skillId: r.skillId } : {}) },
      reason: { code: "needs_review", skillName: r.skillName },
      completion: "practice_attempt",
    });
  }

  for (const l of input.nextLessons.slice(0, 2)) {
    add({
      id: `lesson:${l.lessonId}`,
      kind: "next_lesson",
      minutes: l.minutes,
      title: l.title,
      chapterTitle: l.chapterTitle,
      target: { lessonId: l.lessonId, chapterId: l.chapterId },
      reason: { code: "next_in_order" },
      completion: "lesson_read",
    });
  }

  for (const p of input.practiceChapters) {
    add({
      id: `practice:${p.chapterId}`,
      kind: "practice_chapter",
      minutes: TASK_MINUTES.practice,
      title: p.chapterTitle,
      chapterTitle: p.chapterTitle,
      target: { chapterId: p.chapterId },
      reason: { code: p.reason },
      completion: "practice_attempt",
    });
  }

  // One task per target: a skill already covered by recovery isn't reviewed again, and a lesson
  // being continued isn't offered as "next".
  const seen = new Set<string>();
  const unique = candidates.filter((t) => {
    const keys = [t.id, t.target.skillId ? `skill:${t.target.skillId}` : "", t.target.lessonId ? `lesson:${t.target.lessonId}` : ""].filter(Boolean);
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });

  const tasks: StudyTaskDto[] = [];
  let planned = 0;
  for (const task of unique) {
    if (tasks.length > 0 && planned + task.minutes > input.sessionMinutes) continue;
    tasks.push(task);
    planned += task.minutes;
    if (planned >= input.sessionMinutes) break;
  }

  return {
    date: input.date,
    sessionMinutes: input.sessionMinutes,
    studyDay: input.studyDay,
    tasks,
    plannedMinutes: planned,
    doneToday: input.doneToday,
    openMistakes: input.openMistakes,
  };
}

export const TASK_KINDS: readonly StudyTaskKind[] = ["diagnostic", "continue_lesson", "recover_mistakes", "review_skill", "next_lesson", "practice_chapter"];

/** Everything the plan is built from, in a backend-neutral shape. */
export interface PlanSource {
  date: string;
  locale: Locale;
  sessionMinutes: number;
  /** 0 = Sunday … 6 = Saturday. */
  studyDays: number[];
  diagnosticStatus: DiagnosticStatus;
  curriculum: Omit<CurriculumShape, "lessons"> & {
    lessons: { id: string; chapterId: string; title: LocalizedText; body: LocalizedText; minutes: number }[];
  };
  /** Subjects the learner studies. */
  activeSubjects: Set<string>;
  completedLessons: Set<string>;
  /** Furthest block reached per lesson started. */
  lessonProgress: Map<string, number>;
  progress: Map<string, SkillProgressDto>;
  openMistakes: { id: string; questionId: string; chapterId: string | null; skillId: string | null; createdAt: Date }[];
  /** recommendChapters output, best first. */
  recommendations: { chapterId: string; chapterTitle: LocalizedText; reason: "weak" | "forgetting" | "not_started" }[];
  todayAttempts: { mode: AttemptMode; chapterId: string | null; skillId: string | null }[];
  lessonsCompletedToday: string[];
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/**
 * Turns the learner's content and evidence into planner input. Work finished today closes its task
 * for the day (a recovery or practice session, a lesson read), so the plan moves on instead of
 * repeating it; recovery is only offered when another question exists on the skill.
 */
export function assemblePlanInput(src: PlanSource): PlanInput {
  const c = src.curriculum;
  const chapterById = new Map(c.chapters.map((ch) => [ch.id, ch]));
  const active = (chapterId: string | null) => {
    const ch = chapterId ? chapterById.get(chapterId) : undefined;
    return ch && src.activeSubjects.has(ch.subjectId) ? ch : null;
  };
  const chapterTitle = (chapterId: string) => chapterById.get(chapterId)?.title ?? {};

  const practisedSkills = new Set(src.todayAttempts.filter((a) => a.skillId && a.mode !== "checkpoint").map((a) => a.skillId!));
  const practisedChapters = new Set(
    src.todayAttempts.filter((a) => a.chapterId && (a.mode === "practice" || a.mode === "recovery")).map((a) => a.chapterId!),
  );
  const recoveredToday = new Set(
    src.todayAttempts.filter((a) => a.mode === "recovery" && a.chapterId).map((a) => skillKeyFor(a.skillId, a.chapterId!)),
  );

  const unfinishedLessons = c.lessons
    .filter((l) => active(l.chapterId) && !src.completedLessons.has(l.id) && src.lessonProgress.has(l.id))
    .map((l) => ({
      lessonId: l.id,
      title: l.title,
      chapterId: l.chapterId,
      chapterTitle: chapterTitle(l.chapterId),
      minutes: l.minutes,
      block: src.lessonProgress.get(l.id) ?? 0,
      blocks: splitLessonBlocks(localize(l.body, src.locale)).length,
    }));

  const counts = practiceCounts(c);
  const mistakeSkills = groupBySkill(
    src.openMistakes.filter((m) => m.chapterId && active(m.chapterId)).map((m) => ({ ...m, skillKey: skillKeyFor(m.skillId, m.chapterId!) })),
  )
    .filter((g) => !recoveredToday.has(g.skillKey))
    .filter((g) => (counts.get(g.skillKey) ?? 0) > new Set(g.items.map((i) => i.questionId)).size)
    .map((g) => {
      const first = g.items[0]!;
      return {
        skillKey: g.skillKey,
        skillId: first.skillId,
        chapterId: first.chapterId!,
        chapterTitle: chapterTitle(first.chapterId!),
        skillName: src.progress.get(g.skillKey)?.name ?? chapterTitle(first.chapterId!),
        count: g.items.length,
      };
    });

  const reviewSkills = [...src.progress.values()]
    .filter((p) => p.status === "needs_review" && active(p.chapterId) && !(p.skillId && practisedSkills.has(p.skillId)))
    .map((p) => ({ skillKey: p.key, skillId: p.skillId, chapterId: p.chapterId, chapterTitle: chapterTitle(p.chapterId), skillName: p.name }));

  const recs = src.recommendations.filter((r) => !practisedChapters.has(r.chapterId));
  const preferred = recs.map((r) => r.chapterId);
  const order = [...preferred, ...c.chapters.map((ch) => ch.id).filter((id) => !preferred.includes(id))];
  const nextLessons = order
    .flatMap((chapterId) => (active(chapterId) ? c.lessons.filter((l) => l.chapterId === chapterId) : []))
    .filter((l) => !src.completedLessons.has(l.id) && !src.lessonProgress.has(l.id))
    .map((l) => ({ lessonId: l.id, title: l.title, chapterId: l.chapterId, chapterTitle: chapterTitle(l.chapterId), minutes: l.minutes }));

  const lessonTitle = new Map(c.lessons.map((l) => [l.id, l.title]));
  const doneToday: TodayPlanDto["doneToday"] = [
    ...src.lessonsCompletedToday.map((id) => ({ kind: "next_lesson" as const, title: lessonTitle.get(id) ?? null })),
    ...src.todayAttempts
      .filter((a) => a.mode !== "checkpoint")
      .map((a) => ({
        kind: a.mode === "diagnostic" ? ("diagnostic" as const) : a.mode === "recovery" ? ("recover_mistakes" as const) : ("practice_chapter" as const),
        title: a.chapterId ? chapterTitle(a.chapterId) : null,
      })),
  ];

  return {
    date: src.date,
    sessionMinutes: src.sessionMinutes,
    studyDay: src.studyDays.includes(weekday(src.date)),
    diagnosticStatus: src.diagnosticStatus,
    diagnosticAvailable: [...src.progress.values()].some((p) => p.questionCount > 0 && active(p.chapterId)),
    unfinishedLessons,
    mistakeSkills,
    reviewSkills,
    nextLessons,
    practiceChapters: recs.map((r) => ({ chapterId: r.chapterId, chapterTitle: r.chapterTitle, reason: r.reason })),
    doneToday,
    openMistakes: src.openMistakes.filter((m) => active(m.chapterId)).length,
  };
}
