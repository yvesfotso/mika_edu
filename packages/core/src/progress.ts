import type { LocalizedText } from "./i18n";
import { MASTERY_RULES, chapterStatus, skillKeyFor, skillMastery, statusTotals, type MasteryRules } from "./skills";
import type { AttemptMode, ChapterProgressDto, ProgressDto, QuestionPurpose, SkillProgressDto, SkillStatus } from "./types";

/** The published curriculum of one track, in a backend-neutral shape. */
export interface CurriculumShape {
  chapters: { id: string; subjectId: string; title: LocalizedText }[];
  /** In display order. */
  skills: { id: string; chapterId: string; name: LocalizedText }[];
  questions: { id: string; chapterId: string; skillId: string | null; purpose: QuestionPurpose }[];
  lessons: { id: string; chapterId: string }[];
}

/** One graded answer that counts as evidence. */
export interface LearnerEvidence {
  questionId: string;
  chapterId: string;
  skillId: string | null;
  correct: boolean;
  hintsUsed: number;
  at: Date;
  mode: AttemptMode;
}

export interface SkillSlot {
  key: string;
  skillId: string | null;
  chapterId: string;
  name: LocalizedText;
}

/** Skills of a chapter in order, plus a chapter-wide slot for questions without a skill. */
export function skillSlots(c: CurriculumShape, chapterId: string): SkillSlot[] {
  const chapter = c.chapters.find((ch) => ch.id === chapterId);
  const skills = c.skills.filter((s) => s.chapterId === chapterId);
  const slots: SkillSlot[] = skills.map((s) => ({ key: s.id, skillId: s.id, chapterId, name: s.name }));
  const unskilled = c.questions.some((q) => q.chapterId === chapterId && !q.skillId);
  if (skills.length === 0 || unskilled) slots.push({ key: skillKeyFor(null, chapterId), skillId: null, chapterId, name: chapter?.title ?? {} });
  return slots;
}

export function practiceCounts(c: CurriculumShape): Map<string, number> {
  const counts = new Map<string, number>();
  for (const q of c.questions) {
    if (q.purpose !== "practice") continue;
    const key = skillKeyFor(q.skillId, q.chapterId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Status of every skill slot in the curriculum, from the learner's evidence. */
export function computeSkillProgress(
  c: CurriculumShape,
  evidence: LearnerEvidence[],
  now: Date,
  timeZone: string,
  rules: MasteryRules = MASTERY_RULES,
): Map<string, SkillProgressDto> {
  const bySkill = new Map<string, LearnerEvidence[]>();
  for (const e of evidence) {
    const key = skillKeyFor(e.skillId, e.chapterId);
    bySkill.set(key, [...(bySkill.get(key) ?? []), e]);
  }
  const counts = practiceCounts(c);
  const progress = new Map<string, SkillProgressDto>();
  for (const slot of c.chapters.flatMap((ch) => skillSlots(c, ch.id))) {
    const questionCount = counts.get(slot.key) ?? 0;
    const m = skillMastery(bySkill.get(slot.key) ?? [], questionCount, now, timeZone, rules);
    progress.set(slot.key, { key: slot.key, skillId: slot.skillId, chapterId: slot.chapterId, name: slot.name, questionCount, ...m });
  }
  return progress;
}

/** Chapter status, skills, reading and open mistakes. Skills without practice questions don't count. */
export function chapterProgressOf(
  c: CurriculumShape,
  progress: Map<string, SkillProgressDto>,
  chapterId: string,
  completedLessons: Set<string>,
  openMistakes: { chapterId: string | null }[],
): Omit<ChapterProgressDto, "title" | "subjectId"> {
  const skills = skillSlots(c, chapterId).map((s) => progress.get(s.key)!).filter(Boolean);
  const lessons = c.lessons.filter((l) => l.chapterId === chapterId);
  return {
    chapterId,
    status: chapterStatus(skills.filter((s) => s.questionCount > 0).map((s) => s.status)),
    skills,
    lessonCount: lessons.length,
    lessonsRead: lessons.filter((l) => completedLessons.has(l.id)).length,
    openMistakes: openMistakes.filter((m) => m.chapterId === chapterId).length,
  };
}

export function subjectSkillTotals(c: CurriculumShape, progress: Map<string, SkillProgressDto>, subjectId: string): Record<SkillStatus, number> {
  const chapterIds = new Set(c.chapters.filter((ch) => ch.subjectId === subjectId).map((ch) => ch.id));
  return statusTotals([...progress.values()].filter((p) => chapterIds.has(p.chapterId) && p.questionCount > 0).map((p) => p.status));
}

export function buildProgressDto(
  c: CurriculumShape,
  progress: Map<string, SkillProgressDto>,
  subjects: { id: string; name: LocalizedText; icon: string | null; coefficient: number }[],
  completedLessons: Set<string>,
  openMistakes: { chapterId: string | null }[],
): ProgressDto {
  const list = subjects
    .map((s) => ({
      ...s,
      chapters: c.chapters
        .filter((ch) => ch.subjectId === s.id)
        .map((ch) => ({ ...chapterProgressOf(c, progress, ch.id, completedLessons, openMistakes), title: ch.title, subjectId: ch.subjectId })),
    }))
    .filter((s) => s.chapters.length > 0);
  const assessed = list.flatMap((s) => s.chapters.flatMap((ch) => ch.skills.filter((k) => k.questionCount > 0).map((k) => k.status)));
  return { subjects: list, totals: statusTotals(assessed) };
}
