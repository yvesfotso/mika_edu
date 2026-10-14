import type {
  AnswerInputDto,
  AttemptResultDto,
  ChapterDto,
  CheckpointResultDto,
  DashboardDto,
  ExamDto,
  LessonDto,
  MistakeDto,
  ProfileDto,
  ProgressDto,
  StudyPackDto,
} from "@eduprep/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptView } from "@/lib/learning";

const memory = new Map<string, unknown>();
vi.mock("@/lib/storage", () => ({
  store: {
    get: (k: string) => (memory.has(k) ? structuredClone(memory.get(k)) : null),
    set: (k: string, v: unknown) => memory.set(k, structuredClone(v)),
    remove: (k: string) => memory.delete(k),
    removePrefix: () => undefined,
  },
}));
vi.mock("@/lib/ids", () => ({ randomId: () => crypto.randomUUID() }));
vi.mock("@/lib/learning", () => ({}));

const { DEMO_ACCOUNT, demoRequest, ensureDemoUserState } = await import("./server");
const content = (await import("./content.json")).default;

const demo = DEMO_ACCOUNT.userId;
const call = <T>(method: string, path: string, body?: unknown, user: string | null = demo) => demoRequest<T>(method, path, body, user);
const uuid = () => crypto.randomUUID();

const complexes = content.chapters.find((c) => c.title.en === "Complex numbers")!;
const lesson = complexes.lessons[0]!;
const questions = new Map(content.chapters.flatMap((c) => c.questions.map((q) => [q.id, q])));
const skill = (en: string) => complexes.skills.find((s) => s.name.en === en)!.id;

function answerFor(questionId: string, correct: boolean): AnswerInputDto {
  const q = questions.get(questionId)!;
  if (q.type === "numeric") return { questionId, numericValue: correct ? q.numericAnswer! : q.numericAnswer! + 1 };
  const option = q.options.find((o) => o.isCorrect === correct && (correct || o.misconception)) ?? q.options.find((o) => o.isCorrect === correct)!;
  return { questionId, selectedOptionIds: [option.id] };
}

async function quiz(body: Record<string, unknown>, correct: (questionId: string, i: number) => boolean, extra: Partial<AnswerInputDto> = {}) {
  const view = await call<AttemptView>("POST", "/quiz-attempts", { clientAttemptId: uuid(), ...body });
  const answers = view.attempt.questions.map((q, i) => ({ ...answerFor(q.id, correct(q.id, i)), ...extra }));
  const { result } = await call<{ result: AttemptResultDto }>("POST", `/quiz-attempts/${view.attempt.id}/submit`, { answers });
  return { view, result };
}

beforeEach(() => {
  memory.clear();
  ensureDemoUserState(demo, "Amina", "fr");
});

describe("learning loop: lessons and checkpoints", () => {
  it("serves checkpoints without answer keys and resumes the reading position", async () => {
    const { lesson: l } = await call<{ lesson: LessonDto }>("GET", `/lessons/${lesson.id}`);
    expect(l.checkpoints.map((c) => c.afterBlock)).toEqual([1, 2, 3]);
    expect(JSON.stringify(l.checkpoints)).not.toMatch(/isCorrect|numericAnswer|explanation/);
    expect(l.checkpoints[0]!.question.hint).not.toBeNull();

    await call("POST", `/lessons/${lesson.id}/progress`, { block: 2 });
    await call("POST", `/lessons/${lesson.id}/progress`, { block: 1 });
    const again = await call<{ lesson: LessonDto }>("GET", `/lessons/${lesson.id}`);
    expect(again.lesson.progress.lastBlock).toBe(2);
  });

  it("marks a wrong checkpoint with an explanation and the authored misconception, idempotently", async () => {
    const cp = lesson.checkpoints[0]!;
    const body = { clientAttemptId: uuid(), lessonId: lesson.id, ...answerFor(cp.questionId, false) };
    const first = await call<{ result: CheckpointResultDto }>("POST", "/checkpoints", body);
    expect(first.result.correct).toBe(false);
    expect(first.result.explanation.en).toBeTruthy();
    expect(first.result.misconception).not.toBeNull();
    expect(first.result.mistakeId).toBeTruthy();

    const replay = await call<{ result: CheckpointResultDto }>("POST", "/checkpoints", body);
    expect(replay.result.mistakeId).toBe(first.result.mistakeId);
    const { mistakes } = await call<{ mistakes: MistakeDto[] }>("GET", "/me/mistakes?status=open");
    expect(mistakes.filter((m) => m.question.id === cp.questionId)).toHaveLength(1);

    const { lesson: l } = await call<{ lesson: LessonDto }>("GET", `/lessons/${lesson.id}`);
    expect(l.progress.checkpoints[cp.questionId]?.correct).toBe(false);
  });

  it("keeps reading separate from mastery: opening and completing a lesson adds no evidence", async () => {
    const before = await call<ProgressDto>("GET", "/me/progress");
    await call("GET", `/lessons/${lesson.id}`);
    await call("GET", `/lessons/${lesson.id}`);
    await call("POST", `/lessons/${lesson.id}/complete`, { secondsSpent: 60 });
    const after = await call<ProgressDto>("GET", "/me/progress");
    expect(after.totals).toEqual(before.totals);
  });
});

describe("learning loop: mistakes and recovery", () => {
  it("files the seeded wrong answer and recovers it with a different question on the same skill", async () => {
    const conjugue = skill("Conjugate");
    const { mistakes } = await call<{ mistakes: MistakeDto[] }>("GET", "/me/mistakes?status=open");
    const m = mistakes.find((x) => x.skill.id === conjugue)!;
    expect(m).toBeTruthy();
    expect(m.misconception).not.toBeNull();
    expect(m.canRetry).toBe(true);
    expect(m.lesson).toEqual({ id: lesson.id, block: 2 });

    await call("POST", `/me/mistakes/${m.id}/review`);
    const reviewed = await call<{ mistakes: MistakeDto[] }>("GET", "/me/mistakes");
    expect(reviewed.mistakes.find((x) => x.id === m.id)!.status).toBe("reviewed");

    // Recovery leaves out the missed question and offers a different one.
    const { view, result } = await quiz({ mode: "recovery", skillId: conjugue, excludeQuestionIds: [m.question.id], questionCount: 2 }, () => true);
    expect(view.attempt.questions.some((q) => q.id === m.question.id)).toBe(false);
    expect(view.attempt.questions.every((q) => q.skillId === conjugue)).toBe(true);
    expect(result.score).toBe(result.maxScore);

    const after = await call<{ mistakes: MistakeDto[]; counts: Record<string, number> }>("GET", "/me/mistakes?status=all");
    const recovered = after.mistakes.find((x) => x.id === m.id)!;
    expect(recovered.status).toBe("recovered");
    expect(recovered.recoveredAt).toBeTruthy();
    // History stays visible.
    expect(after.counts.recovered).toBe(1);
  });

  it("does not count a hinted success, or the same question again, as recovery", async () => {
    const conjugue = skill("Conjugate");
    const { mistakes } = await call<{ mistakes: MistakeDto[] }>("GET", "/me/mistakes?status=open");
    const m = mistakes.find((x) => x.skill.id === conjugue)!;

    await quiz({ mode: "recovery", skillId: conjugue, excludeQuestionIds: [m.question.id], questionCount: 1 }, () => true, { hintsUsed: 1 });
    let current = (await call<{ mistakes: MistakeDto[] }>("GET", "/me/mistakes")).mistakes.find((x) => x.id === m.id)!;
    expect(current.status).not.toBe("recovered");

    // Retrying the very same question correctly is recorded, but is not recovery.
    const view = await call<AttemptView>("POST", "/quiz-attempts", { clientAttemptId: uuid(), mode: "practice", chapterId: complexes.id, questionCount: 20 });
    const same = view.attempt.questions.find((q) => q.id === m.question.id)!;
    await call("POST", `/quiz-attempts/${view.attempt.id}/submit`, { answers: [answerFor(same.id, true)] });
    current = (await call<{ mistakes: MistakeDto[] }>("GET", "/me/mistakes")).mistakes.find((x) => x.id === m.id)!;
    expect(current.retriedCorrectAt).toBeTruthy();
    expect(current.status).not.toBe("recovered");
  });

  it("says so when no other question exists on the skill", async () => {
    const conjugue = skill("Conjugate");
    const all = complexes.questions.filter((q) => q.skillId === conjugue && q.purpose === "practice").map((q) => q.id);
    await expect(call("POST", "/quiz-attempts", { clientAttemptId: uuid(), mode: "recovery", skillId: conjugue, excludeQuestionIds: all })).rejects.toMatchObject({
      code: "no_other_questions",
    });
  });

  it("keeps each learner's mistakes private", async () => {
    const other = "5eed0000-0000-4000-8000-0000000000aa";
    ensureDemoUserState(other, "Paul", "en");
    const { mistakes } = await call<{ mistakes: MistakeDto[] }>("GET", "/me/mistakes");
    const mine = mistakes[0]!;
    const theirs = await call<{ mistakes: MistakeDto[] }>("GET", "/me/mistakes", undefined, other);
    expect(theirs.mistakes).toEqual([]);
    await expect(call("POST", `/me/mistakes/${mine.id}/review`, {}, other)).rejects.toMatchObject({ status: 404 });
  });
});

describe("learning loop: mastery states", () => {
  it("explains each skill's status and never claims mastery from hints or one session", async () => {
    const progress = await call<ProgressDto>("GET", "/me/progress");
    const chapter = progress.subjects.flatMap((s) => s.chapters).find((c) => c.chapterId === complexes.id)!;
    const byName = new Map(chapter.skills.map((s) => [s.name.en, s]));
    expect(byName.get("Algebraic form and arithmetic")).toMatchObject({ status: "not_assessed", reason: "no_evidence" });
    expect(byName.get("Conjugate")).toMatchObject({ status: "learning", reason: "recent_error" });
    expect(byName.get("Modulus and argument")!.evidence.distinctCorrect).toBe(2);

    // Three hinted successes on algebraic form don't count…
    const algebra = skill("Algebraic form and arithmetic");
    await quiz({ mode: "practice", skillId: algebra, questionCount: 3 }, () => true, { hintsUsed: 1 });
    // …and three clean ones in one session aren't enough either.
    await quiz({ mode: "practice", skillId: algebra, questionCount: 3 }, () => true);
    const after = await call<ProgressDto>("GET", "/me/progress");
    const s = after.subjects.flatMap((x) => x.chapters).flatMap((c) => c.skills).find((k) => k.skillId === algebra)!;
    expect(s.status).toBe("learning");
    expect(s.reason).toBe("needs_more_sessions");
    expect(s.evidence.hintedCorrect).toBeGreaterThanOrEqual(1);
  });

  it("shows chapter status and open mistakes on the Learn screen", async () => {
    const dashboard = await call<DashboardDto>("GET", "/me/dashboard");
    const maths = dashboard.subjects.find((s) => s.slug === "mathematics")!;
    expect(maths.skillTotals.learning).toBeGreaterThan(0);
    const { chapters } = await call<{ chapters: ChapterDto[] }>("GET", `/tracks/${dashboard.profile.targetTrackId}/subjects/${maths.id}/chapters`);
    const ch = chapters.find((c) => c.id === complexes.id)!;
    expect(ch.status).toBe("learning");
    expect(ch.openMistakes).toBe(1);
    // Checkpoints are not counted as practice questions.
    expect(ch.questionCount).toBe(complexes.questions.filter((q) => q.purpose === "practice").length);
  });
});

describe("learning loop: today plan", () => {
  it("offers recovery first for the demo account, with reasons, durations and working targets", async () => {
    const { today } = await call<DashboardDto>("GET", "/me/dashboard");
    expect(today.tasks.length).toBeGreaterThan(0);
    expect(today.tasks[0]!.kind).toBe("recover_mistakes");
    expect(today.tasks[0]!.reason).toMatchObject({ code: "recent_mistakes", count: 1 });
    expect(today.plannedMinutes).toBeLessThanOrEqual(today.sessionMinutes);
    expect(new Set(today.tasks.map((t) => t.id)).size).toBe(today.tasks.length);
    expect(today.openMistakes).toBe(1);
  });

  it("moves on once a task is done today", async () => {
    const { today } = await call<DashboardDto>("GET", "/me/dashboard");
    const task = today.tasks.find((t) => t.kind === "recover_mistakes")!;
    await quiz({ mode: "recovery", skillId: task.target.skillId, questionCount: 2 }, () => false);
    const next = await call<DashboardDto>("GET", "/me/dashboard");
    expect(next.today.tasks.some((t) => t.id === task.id)).toBe(false);
    expect(next.today.doneToday.some((d) => d.kind === "recover_mistakes")).toBe(true);
  });

  it("puts the diagnostic first for a new learner, and completes it", async () => {
    const user = "5eed0000-0000-4000-8000-0000000000bb";
    ensureDemoUserState(user, "Nadia", "fr");
    const { exams } = await call<{ exams: ExamDto[] }>("GET", "/exams", undefined, user);
    const bac = exams.find((e) => e.slug === "cm-bac")!;
    const serieD = bac.tracks.find((t) => t.slug === "serie-d")!;
    await call("PATCH", "/me", { targetExamId: bac.id, targetTrackId: serieD.id, programSettings: { targetAverage: 12 }, studyDays: [1, 3, 5], onboardingCompleted: true }, user);

    const d = await call<DashboardDto>("GET", "/me/dashboard", undefined, user);
    expect(d.profile.diagnosticStatus).toBe("pending");
    expect(d.profile.studyDays).toEqual([1, 3, 5]);
    expect(d.today.tasks[0]!.kind).toBe("diagnostic");

    const view = await call<AttemptView>("POST", "/quiz-attempts", { clientAttemptId: uuid(), mode: "diagnostic" }, user);
    // One question per assessable skill, no hints in a diagnostic.
    expect(view.attempt.questions.length).toBe(4);
    expect(view.attempt.questions.every((q) => q.hint === null)).toBe(true);
    const answers = view.attempt.questions.map((q, i) => answerFor(q.id, i !== 0));
    await call("POST", `/quiz-attempts/${view.attempt.id}/submit`, { answers }, user);

    const after = await call<DashboardDto>("GET", "/me/dashboard", undefined, user);
    expect(after.profile.diagnosticStatus).toBe("completed");
    expect(after.today.tasks.some((t) => t.kind === "diagnostic")).toBe(false);
  });

  it("labels skipped-diagnostic skills as not assessed rather than failed", async () => {
    const user = "5eed0000-0000-4000-8000-0000000000cc";
    ensureDemoUserState(user, "Eric", "en");
    const { exams } = await call<{ exams: ExamDto[] }>("GET", "/exams", undefined, user);
    const bac = exams.find((e) => e.slug === "cm-bac")!;
    await call("PATCH", "/me", { targetExamId: bac.id, targetTrackId: bac.tracks[1]!.id, programSettings: { targetAverage: 12 }, onboardingCompleted: true, diagnosticStatus: "skipped" }, user);
    const p = await call<ProgressDto>("GET", "/me/progress", undefined, user);
    expect(p.totals.not_assessed).toBeGreaterThan(0);
    expect(p.totals.learning + p.totals.mastered + p.totals.needs_review).toBe(0);
    const profile = await call<{ profile: ProfileDto }>("GET", "/me", undefined, user);
    expect(profile.profile.diagnosticStatus).toBe("skipped");
  });
});

describe("learning loop: offline packs and sync", () => {
  it("downloads a versioned pack with keys for offline marking", async () => {
    const { pack } = await call<{ pack: StudyPackDto }>("GET", `/chapters/${complexes.id}/pack`);
    expect(pack.version).toMatch(/^\d+-[0-9a-f]{8}$/);
    expect(pack.lessons[0]!.checkpoints).toHaveLength(3);
    expect(pack.questions.every((q) => q.key && q.explanation)).toBe(true);
    const again = await call<{ pack: StudyPackDto }>("GET", `/chapters/${complexes.id}/pack`);
    expect(again.pack.version).toBe(pack.version);
  });

  it("syncs an offline session once, even if replayed, and ignores answers to outdated versions", async () => {
    const { pack } = await call<{ pack: StudyPackDto }>("GET", `/chapters/${complexes.id}/pack`);
    const practice = pack.questions.filter((q) => q.purpose === "practice").slice(0, 3);
    const started = new Date(Date.now() - 10 * 60_000).toISOString();
    const body = {
      clientAttemptId: uuid(),
      mode: "practice",
      chapterId: complexes.id,
      packVersion: pack.version,
      // The third question was answered from an older pack.
      questions: practice.map((q, i) => ({ questionId: q.id, version: i === 2 ? q.version + 1 : q.version })),
      answers: practice.map((q) => ({ ...answerFor(q.id, false), answeredAt: started })),
      startedAt: started,
      submittedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    };
    const first = await call<{ result: AttemptResultDto; duplicate: boolean; staleQuestions: number }>("POST", "/offline-attempts", body);
    expect(first.duplicate).toBe(false);
    expect(first.staleQuestions).toBe(1);
    const replay = await call<{ result: AttemptResultDto; duplicate: boolean }>("POST", "/offline-attempts", body);
    expect(replay.duplicate).toBe(true);
    expect(replay.result.attemptId).toBe(first.result.attemptId);

    const { attempts } = await call<{ attempts: { id: string }[] }>("GET", "/me/attempts");
    expect(attempts.filter((a) => a.id === first.result.attemptId)).toHaveLength(1);
    // Two counted wrong answers become mistakes; the outdated one does not.
    expect(first.result.results.filter((r) => r.mistakeId).length).toBe(2);
  });
});

describe("learning loop: content reports", () => {
  it("accepts a report once per item while open", async () => {
    const questionId = complexes.questions[3]!.id;
    const a = await call<{ duplicate: boolean }>("POST", "/content-reports", { questionId, reason: "unclear", message: "?" });
    const b = await call<{ duplicate: boolean }>("POST", "/content-reports", { questionId, reason: "typo" });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    await expect(call("POST", "/content-reports", { reason: "typo" })).rejects.toMatchObject({ status: 422 });
  });
});

describe("learning loop: malformed and duplicate input", () => {
  it("keeps the last answer when a question is sent twice in one sync", async () => {
    const { pack } = await call<{ pack: StudyPackDto }>("GET", `/chapters/${complexes.id}/pack`);
    const q = pack.questions.find((x) => x.purpose === "practice")!;
    const body = {
      clientAttemptId: uuid(),
      mode: "practice" as const,
      chapterId: complexes.id,
      packVersion: pack.version,
      questions: [{ questionId: q.id, version: q.version }],
      answers: [answerFor(q.id, false), answerFor(q.id, true)],
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      submittedAt: new Date().toISOString(),
    };
    const { result } = await call<{ result: AttemptResultDto }>("POST", "/offline-attempts", body);
    expect(result.maxScore).toBe(1);
    expect(result.score).toBe(1);
  });
});
