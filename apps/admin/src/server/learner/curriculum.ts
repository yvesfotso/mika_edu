import "server-only";
import {
  activeSubjectIds,
  recommendChapters,
  retainedScore,
  type ChapterDto,
  type LocalizedText,
  type MasteryState,
  type ProgramSettings,
  type RecommendationDto,
  type SubjectSummaryDto,
} from "@eduprep/core";
import { must, notFound, type Db } from "../db";
import { parseProgram, type ProfileRow } from "../mappers";
import { chapterProgress, loadLearningState, skillTotalsFor, type LearningState } from "./learning";

interface TrackSubjectRow {
  coefficient: number;
  order_index: number;
  subjects: { id: string; slug: string; name: LocalizedText; icon: string | null };
}
interface ChapterRow {
  id: string;
  subject_id: string;
  title: LocalizedText;
  order_index: number;
}
interface LessonRow {
  id: string;
  chapter_id: string;
  title: LocalizedText;
  body: LocalizedText;
  estimated_minutes: number;
  order_index: number;
}
export interface SkillRow {
  id: string;
  chapter_id: string;
  name: LocalizedText;
  order_index: number;
}
export interface QuestionMetaRow {
  id: string;
  chapter_id: string;
  skill_id: string | null;
  purpose: "practice" | "checkpoint";
}
interface MasteryRow {
  chapter_id: string;
  score: number;
  confidence: number;
  attempts_count: number;
  last_practiced_at: string | null;
}

/** Everything a learner needs to navigate one exam track, loaded in a handful of queries. */
export interface TrackState {
  trackId: string;
  subjects: TrackSubjectRow[];
  chapters: ChapterRow[];
  lessons: LessonRow[];
  skills: SkillRow[];
  /** Published questions of the track's chapters (practice and checkpoints). */
  questions: QuestionMetaRow[];
  /** Practice questions per chapter. */
  questionCounts: Map<string, number>;
  /** Furthest block reached per lesson. */
  lessonProgress: Map<string, number>;
  mastery: Map<string, MasteryState>;
  completedLessons: Set<string>;
  /** Subjects the learner studies (their GCE subject choice, or the whole track). */
  activeSubjects: Set<string>;
  targetGrades: Record<string, string>;
}

export function toMasteryState(row: MasteryRow): MasteryState {
  return {
    score: Number(row.score),
    confidence: Number(row.confidence),
    attemptsCount: row.attempts_count,
    lastPracticedAt: row.last_practiced_at ? new Date(row.last_practiced_at) : null,
  };
}

export async function loadTrackState(db: Db, userId: string, trackId: string): Promise<TrackState> {
  const [trackRes, profileRes] = await Promise.all([
    db.from("exam_tracks").select("id, exams(program_config)").eq("id", trackId).maybeSingle(),
    db.from("profiles").select("target_track_id, program_settings").eq("id", userId).maybeSingle(),
  ]);
  const track = must(trackRes, "loading track") as unknown as { id: string; exams: { program_config: unknown } | null } | null;
  if (!track) throw notFound("Track");
  const profile = must(profileRes, "loading profile") as { target_track_id: string | null; program_settings: ProgramSettings | null } | null;
  const program = parseProgram(track.exams?.program_config);
  // Settings only apply to the learner's own track.
  const settings = profile?.target_track_id === trackId ? profile.program_settings : null;

  const nowIso = new Date().toISOString();
  const [subjects, chapters] = await Promise.all([
    db
      .from("track_subjects")
      .select("coefficient, order_index, subjects(id, slug, name, icon)")
      .eq("track_id", trackId)
      .order("order_index")
      .returns<TrackSubjectRow[]>(),
    db
      .from("chapters")
      .select("id, subject_id, title, order_index")
      .eq("track_id", trackId)
      .eq("status", "published")
      .order("order_index")
      .returns<ChapterRow[]>(),
  ]);
  const chapterRows = must(chapters, "loading chapters");
  const subjectRows = must(subjects, "loading subjects");
  const chapterIds = chapterRows.map((c) => c.id);

  const [lessons, questions, mastery, skills] = await Promise.all([
    db
      .from("lessons")
      .select("id, chapter_id, title, body, estimated_minutes, order_index")
      .in("chapter_id", chapterIds)
      .eq("status", "published")
      .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
      .order("order_index")
      .returns<LessonRow[]>(),
    db.from("questions").select("id, chapter_id, skill_id, purpose").in("chapter_id", chapterIds).eq("status", "published").returns<QuestionMetaRow[]>(),
    db
      .from("mastery")
      .select("chapter_id, score, confidence, attempts_count, last_practiced_at")
      .eq("user_id", userId)
      .in("chapter_id", chapterIds)
      .returns<MasteryRow[]>(),
    db.from("skills").select("id, chapter_id, name, order_index").in("chapter_id", chapterIds).order("order_index").returns<SkillRow[]>(),
  ]);
  const lessonRows = must(lessons, "loading lessons");
  const lessonIds = lessonRows.map((l) => l.id);

  const [completionsRes, progressRes] = await Promise.all([
    db.from("lesson_completions").select("lesson_id").eq("user_id", userId).in("lesson_id", lessonIds),
    db.from("lesson_progress").select("lesson_id, last_block").eq("user_id", userId).in("lesson_id", lessonIds),
  ]);
  const completions = must(completionsRes, "loading lesson completions") as { lesson_id: string }[];
  const progress = must(progressRes, "loading lesson progress") as { lesson_id: string; last_block: number }[];

  const questionRows = must(questions, "loading questions");
  const questionCounts = new Map<string, number>();
  for (const q of questionRows) {
    if (q.purpose === "practice") questionCounts.set(q.chapter_id, (questionCounts.get(q.chapter_id) ?? 0) + 1);
  }

  return {
    trackId,
    subjects: subjectRows,
    chapters: chapterRows,
    lessons: lessonRows,
    skills: must(skills, "loading skills"),
    questions: questionRows,
    questionCounts,
    lessonProgress: new Map(progress.map((p) => [p.lesson_id, p.last_block])),
    mastery: new Map(must(mastery, "loading mastery").map((m) => [m.chapter_id, toMasteryState(m)])),
    completedLessons: new Set(completions.map((c) => c.lesson_id)),
    activeSubjects: new Set(activeSubjectIds(program, subjectRows.map((s) => s.subjects.id), settings)),
    targetGrades: settings?.targetGrades ?? {},
  };
}

/** Track content plus the learner's evidence-derived state, for one request. */
export async function loadLearnerTrack(db: Db, profile: ProfileRow, trackId: string, now: Date) {
  const track = await loadTrackState(db, profile.id, trackId);
  return { track, learning: await loadLearningState(db, profile, track, now) };
}

function chapterMastery(state: TrackState, chapterId: string, now: Date): number {
  const m = state.mastery.get(chapterId);
  return m ? retainedScore(m, now) : 0;
}

export function subjectSummaries(state: TrackState, now: Date, learning: LearningState): SubjectSummaryDto[] {
  return state.subjects.filter((ts) => state.activeSubjects.has(ts.subjects.id)).map((ts) => {
    const chapters = state.chapters.filter((c) => c.subject_id === ts.subjects.id);
    const practicable = chapters.filter((c) => (state.questionCounts.get(c.id) ?? 0) > 0);
    const mastery =
      practicable.length === 0
        ? 0
        : practicable.reduce((sum, c) => sum + chapterMastery(state, c.id, now), 0) / practicable.length;
    return {
      id: ts.subjects.id,
      slug: ts.subjects.slug,
      name: ts.subjects.name,
      icon: ts.subjects.icon,
      coefficient: Number(ts.coefficient),
      chapterCount: chapters.length,
      mastery: Math.round(mastery * 1000) / 1000,
      targetGrade: state.targetGrades[ts.subjects.id] ?? null,
      skillTotals: skillTotalsFor(learning, ts.subjects.id),
    };
  });
}

export function chaptersForSubject(state: TrackState, subjectId: string, now: Date, learning: LearningState): ChapterDto[] {
  if (!state.subjects.some((s) => s.subjects.id === subjectId)) throw notFound("Subject");
  return state.chapters
    .filter((c) => c.subject_id === subjectId)
    .map((c) => ({
      id: c.id,
      subjectId: c.subject_id,
      title: c.title,
      orderIndex: c.order_index,
      mastery: chapterMastery(state, c.id, now),
      questionCount: state.questionCounts.get(c.id) ?? 0,
      ...(({ status, skills, openMistakes }) => ({ status, skills, openMistakes }))(chapterProgress(learning, c.id)),
      lessons: state.lessons
        .filter((l) => l.chapter_id === c.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          estimatedMinutes: l.estimated_minutes,
          completed: state.completedLessons.has(l.id),
        })),
    }));
}

export function recommendations(state: TrackState, now: Date, limit = 3): RecommendationDto[] {
  const coef = new Map(state.subjects.map((s) => [s.subjects.id, Number(s.coefficient)]));
  const subjectName = new Map(state.subjects.map((s) => [s.subjects.id, s.subjects.name]));
  const chapterById = new Map(state.chapters.map((c) => [c.id, c]));

  return recommendChapters(
    state.chapters.filter((c) => state.activeSubjects.has(c.subject_id)).map((c) => ({
      chapterId: c.id,
      subjectId: c.subject_id,
      coefficient: coef.get(c.subject_id) ?? 1,
      orderIndex: c.order_index,
      hasQuestions: (state.questionCounts.get(c.id) ?? 0) > 0,
      mastery: state.mastery.get(c.id) ?? null,
    })),
    now,
    limit,
  ).map((r) => {
    const chapter = chapterById.get(r.chapterId)!;
    return {
      chapterId: r.chapterId,
      chapterTitle: chapter.title,
      subjectName: subjectName.get(chapter.subject_id) ?? {},
      mastery: r.mastery,
      reason: r.reason,
    };
  });
}

/** The next unread lesson, preferring the chapters the learner is recommended to work on. */
export function nextLesson(state: TrackState, preferredChapterIds: string[]) {
  const chapterOrder = [
    ...preferredChapterIds,
    ...state.chapters
      .filter((c) => state.activeSubjects.has(c.subject_id))
      .map((c) => c.id)
      .filter((id) => !preferredChapterIds.includes(id)),
  ];
  for (const chapterId of chapterOrder) {
    const lesson = state.lessons.find((l) => l.chapter_id === chapterId && !state.completedLessons.has(l.id));
    if (lesson) {
      const chapter = state.chapters.find((c) => c.id === chapterId)!;
      return { id: lesson.id, title: lesson.title, chapterTitle: chapter.title };
    }
  }
  return null;
}
