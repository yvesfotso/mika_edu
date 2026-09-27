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
import { parseProgram } from "../mappers";

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
  estimated_minutes: number;
  order_index: number;
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
  questionCounts: Map<string, number>;
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

  const [lessons, questions, mastery] = await Promise.all([
    db
      .from("lessons")
      .select("id, chapter_id, title, estimated_minutes, order_index")
      .in("chapter_id", chapterIds)
      .eq("status", "published")
      .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
      .order("order_index")
      .returns<LessonRow[]>(),
    db.from("questions").select("chapter_id").in("chapter_id", chapterIds).eq("status", "published"),
    db
      .from("mastery")
      .select("chapter_id, score, confidence, attempts_count, last_practiced_at")
      .eq("user_id", userId)
      .in("chapter_id", chapterIds)
      .returns<MasteryRow[]>(),
  ]);
  const lessonRows = must(lessons, "loading lessons");

  const completions = must(
    await db.from("lesson_completions").select("lesson_id").eq("user_id", userId).in(
      "lesson_id",
      lessonRows.map((l) => l.id),
    ),
    "loading lesson completions",
  ) as { lesson_id: string }[];

  const questionCounts = new Map<string, number>();
  for (const q of must(questions, "counting questions") as { chapter_id: string }[]) {
    questionCounts.set(q.chapter_id, (questionCounts.get(q.chapter_id) ?? 0) + 1);
  }

  return {
    trackId,
    subjects: subjectRows,
    chapters: chapterRows,
    lessons: lessonRows,
    questionCounts,
    mastery: new Map(must(mastery, "loading mastery").map((m) => [m.chapter_id, toMasteryState(m)])),
    completedLessons: new Set(completions.map((c) => c.lesson_id)),
    activeSubjects: new Set(activeSubjectIds(program, subjectRows.map((s) => s.subjects.id), settings)),
    targetGrades: settings?.targetGrades ?? {},
  };
}

function chapterMastery(state: TrackState, chapterId: string, now: Date): number {
  const m = state.mastery.get(chapterId);
  return m ? retainedScore(m, now) : 0;
}

export function subjectSummaries(state: TrackState, now: Date): SubjectSummaryDto[] {
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
    };
  });
}

export function chaptersForSubject(state: TrackState, subjectId: string, now: Date): ChapterDto[] {
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
