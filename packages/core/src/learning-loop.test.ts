import { describe, expect, it } from "vitest";
import { clampBlock, packVersion, splitLessonBlocks } from "./lessons";
import { groupBySkill, recoveryUpdates, type OpenMistake } from "./mistakes";
import { planToday, type PlanInput } from "./plan";
import { chapterStatus, MASTERY_RULES, skillKeyFor, skillMastery, statusTotals, type SkillEvidence } from "./skills";
import { startAttemptSchema, updateProfileSchema } from "./schemas";

const TZ = "Africa/Douala";
const day = (n: number, hour = 10) => new Date(Date.UTC(2026, 9, 1 + n, hour));
const now = day(10);
const ok = (q: string, at: Date, hintsUsed = 0): SkillEvidence => ({ questionId: q, correct: true, hintsUsed, at, mode: "practice" });
const ko = (q: string, at: Date): SkillEvidence => ({ questionId: q, correct: false, hintsUsed: 0, at, mode: "practice" });

describe("skill mastery", () => {
  it("is not assessed without evidence, and says so rather than failing", () => {
    const m = skillMastery([], 5, now, TZ);
    expect(m.status).toBe("not_assessed");
    expect(m.reason).toBe("no_evidence");
    expect(m.evidence.distinctCorrect).toBe(0);
  });

  it("needs three different questions right without hints, across two days", () => {
    const sameDay = skillMastery([ok("a", day(1)), ok("b", day(1, 11)), ok("c", day(1, 12))], 5, now, TZ);
    expect(sameDay.status).toBe("learning");
    expect(sameDay.reason).toBe("needs_more_sessions");

    const mastered = skillMastery([ok("a", day(1)), ok("b", day(1, 11)), ok("c", day(2))], 5, now, TZ);
    expect(mastered.status).toBe("mastered");
    expect(mastered.evidence).toMatchObject({ distinctCorrect: 3, sessions: 2 });
  });

  it("does not count repeats of the same question or hinted answers", () => {
    const repeats = skillMastery([ok("a", day(1)), ok("a", day(2)), ok("a", day(3)), ok("b", day(3))], 5, now, TZ);
    expect(repeats.status).toBe("learning");
    expect(repeats.reason).toBe("needs_more_correct");

    const hinted = skillMastery([ok("a", day(1), 1), ok("b", day(2), 1), ok("c", day(3), 2)], 5, now, TZ);
    expect(hinted.status).toBe("learning");
    expect(hinted.evidence.hintedCorrect).toBe(3);
    expect(hinted.evidence.distinctCorrect).toBe(0);
  });

  it("moves back to needs review after a later mistake, until two other questions are right", () => {
    const base = [ok("a", day(1)), ok("b", day(1, 11)), ok("c", day(2))];
    const slipped = skillMastery([...base, ko("d", day(3))], 5, now, TZ);
    expect(slipped.status).toBe("needs_review");
    expect(slipped.reason).toBe("recent_error");
    expect(slipped.evidence.unresolvedErrors).toBe(1);

    // Retrying the same question does not resolve the mistake…
    const sameQuestion = skillMastery([...base, ko("d", day(3)), ok("d", day(4)), ok("d", day(5))], 5, now, TZ);
    expect(sameQuestion.status).toBe("needs_review");
    // …two other questions do.
    const resolved = skillMastery([...base, ko("d", day(3)), ok("a", day(4)), ok("e", day(5))], 5, now, TZ);
    expect(resolved.status).toBe("mastered");
  });

  it("asks for review when a mastered skill has not been practised for a while", () => {
    const old = [ok("a", day(-60)), ok("b", day(-59)), ok("c", day(-58))];
    const m = skillMastery(old, 5, now, TZ);
    expect(m.status).toBe("needs_review");
    expect(m.reason).toBe("stale");
  });

  it("flags skills that have too few questions to ever confirm mastery", () => {
    expect(skillMastery([ok("a", day(1)), ok("b", day(2))], 2, now, TZ)).toMatchObject({ status: "learning", reason: "not_enough_questions" });
    expect(skillMastery([], 1, now, TZ).reason).toBe("not_enough_questions");
  });

  it("counts sessions by the learner's calendar day", () => {
    // Different UTC dates, but both on 2 October in Douala (UTC+1).
    const late = new Date(Date.UTC(2026, 9, 1, 23, 30));
    const early = new Date(Date.UTC(2026, 9, 2, 5, 0));
    const m = skillMastery([ok("a", late), ok("b", early), ok("c", early)], 5, now, TZ);
    expect(m.evidence.sessions).toBe(1);
  });

  it("derives chapter status and totals", () => {
    expect(chapterStatus([])).toBe("not_assessed");
    expect(chapterStatus(["not_assessed", "not_assessed"])).toBe("not_assessed");
    expect(chapterStatus(["mastered", "mastered"])).toBe("mastered");
    expect(chapterStatus(["mastered", "needs_review"])).toBe("needs_review");
    expect(chapterStatus(["mastered", "not_assessed"])).toBe("learning");
    expect(statusTotals(["mastered", "learning", "learning"])).toEqual({ not_assessed: 0, learning: 2, needs_review: 0, mastered: 1 });
    expect(skillKeyFor(null, "ch1")).toBe("chapter:ch1");
    expect(skillKeyFor("s1", "ch1")).toBe("s1");
    expect(MASTERY_RULES.minDistinctCorrect).toBe(3);
  });
});

describe("mistake recovery", () => {
  const mistake: OpenMistake = { id: "m1", questionId: "q1", skillKey: "s1", createdAt: day(1), retriedCorrectAt: null, attemptId: "t1" };

  it("recovers only with a different question on the same skill, without a hint", () => {
    const updates = recoveryUpdates(
      [mistake],
      [{ questionId: "q2", skillKey: "s1", correct: true, hintsUsed: 0, at: day(2), answerId: "a2", attemptId: "t2" }],
    );
    expect(updates).toEqual([{ id: "m1", recoveredAt: day(2), recoveredByAnswerId: "a2" }]);
  });

  it("does not recover from a later answer in the same quiz as the mistake", () => {
    const sameQuiz = recoveryUpdates([mistake], [{ questionId: "q2", skillKey: "s1", correct: true, hintsUsed: 0, at: day(2), answerId: "a2", attemptId: "t1" }]);
    expect(sameQuiz).toEqual([]);
  });

  it("records a correct retry of the same question without calling it recovered", () => {
    const updates = recoveryUpdates([mistake], [{ questionId: "q1", skillKey: "s1", correct: true, hintsUsed: 0, at: day(2), answerId: "a", attemptId: "t2" }]);
    expect(updates).toEqual([{ id: "m1", retriedCorrectAt: day(2) }]);
  });

  it("ignores hinted, wrong, earlier or other-skill answers", () => {
    const updates = recoveryUpdates(
      [mistake],
      [
        { questionId: "q2", skillKey: "s1", correct: true, hintsUsed: 1, at: day(2), answerId: "a", attemptId: "t2" },
        { questionId: "q3", skillKey: "s1", correct: false, hintsUsed: 0, at: day(2), answerId: "b", attemptId: "t2" },
        { questionId: "q4", skillKey: "s1", correct: true, hintsUsed: 0, at: day(0), answerId: "c", attemptId: "t0" },
        { questionId: "q5", skillKey: "s2", correct: true, hintsUsed: 0, at: day(3), answerId: "d", attemptId: "t3" },
      ],
    );
    expect(updates).toEqual([]);
  });

  it("groups mistakes by skill, most recent first", () => {
    const groups = groupBySkill([
      { skillKey: "a", createdAt: day(1) },
      { skillKey: "b", createdAt: day(3) },
      { skillKey: "a", createdAt: day(2) },
    ]);
    expect(groups.map((g) => [g.skillKey, g.items.length])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });
});

describe("today plan", () => {
  const base: PlanInput = {
    date: "2026-10-11",
    sessionMinutes: 30,
    studyDay: true,
    diagnosticStatus: "completed",
    diagnosticAvailable: true,
    unfinishedLessons: [],
    mistakeSkills: [],
    reviewSkills: [],
    nextLessons: [],
    practiceChapters: [],
    doneToday: [],
    openMistakes: 0,
  };
  const t = (s: string) => ({ en: s });

  it("puts the diagnostic, unfinished work and mistakes first", () => {
    const plan = planToday({
      ...base,
      diagnosticStatus: "pending",
      unfinishedLessons: [{ lessonId: "L1", title: t("L1"), chapterId: "C1", chapterTitle: t("C1"), minutes: 12, block: 1, blocks: 4 }],
      mistakeSkills: [{ skillKey: "S1", skillId: "S1", chapterId: "C1", chapterTitle: t("C1"), skillName: t("S1"), count: 2 }],
      nextLessons: [{ lessonId: "L2", title: t("L2"), chapterId: "C1", chapterTitle: t("C1"), minutes: 10 }],
    });
    expect(plan.tasks.map((x) => x.kind)).toEqual(["diagnostic", "continue_lesson", "recover_mistakes", "next_lesson"]);
    expect(plan.tasks[1]!.reason).toMatchObject({ code: "unfinished", block: 2, blocks: 4 });
    expect(plan.tasks[2]!.reason).toMatchObject({ code: "recent_mistakes", count: 2 });
    expect(plan.tasks.every((x) => x.minutes > 0 && x.completion)).toBe(true);
  });

  it("respects the session time but always offers one task", () => {
    const chapters = ["A", "B", "C", "D"].map((id) => ({ chapterId: id, chapterTitle: t(id), reason: "weak" as const }));
    const short = planToday({ ...base, sessionMinutes: 15, practiceChapters: chapters });
    expect(short.tasks).toHaveLength(1);
    expect(short.plannedMinutes).toBeLessThanOrEqual(15);
    const tiny = planToday({ ...base, sessionMinutes: 5, practiceChapters: chapters });
    expect(tiny.tasks).toHaveLength(1);
  });

  it("never lists the same skill or lesson twice", () => {
    const plan = planToday({
      ...base,
      sessionMinutes: 120,
      unfinishedLessons: [{ lessonId: "L1", title: t("L1"), chapterId: "C1", chapterTitle: t("C1"), minutes: 12, block: 0, blocks: 3 }],
      nextLessons: [{ lessonId: "L1", title: t("L1"), chapterId: "C1", chapterTitle: t("C1"), minutes: 12 }],
      mistakeSkills: [{ skillKey: "S1", skillId: "S1", chapterId: "C1", chapterTitle: t("C1"), skillName: t("S1"), count: 1 }],
      reviewSkills: [{ skillKey: "S1", skillId: "S1", chapterId: "C1", chapterTitle: t("C1"), skillName: t("S1") }],
    });
    expect(plan.tasks.map((x) => x.id)).toEqual(["lesson:L1", "recover:S1"]);
  });

  it("returns an empty plan when there is no suitable content", () => {
    const plan = planToday({ ...base, diagnosticStatus: "pending", diagnosticAvailable: false });
    expect(plan.tasks).toEqual([]);
    expect(plan.plannedMinutes).toBe(0);
  });
});

describe("lesson blocks", () => {
  it("splits at second-level headings and keeps code fences intact", () => {
    const md = "# Title\nIntro\n\n## One\nText\n```\n## not a heading\n```\n## Two\nMore";
    const blocks = splitLessonBlocks(md);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toBe("# Title\nIntro");
    expect(blocks[1]).toContain("## not a heading");
    expect(blocks[2]).toBe("## Two\nMore");
  });

  it("treats a lesson without headings as one block and clamps positions", () => {
    expect(splitLessonBlocks("Just text")).toEqual(["Just text"]);
    expect(splitLessonBlocks("")).toEqual([""]);
    expect(clampBlock(5, 3)).toBe(2);
    expect(clampBlock(-1, 3)).toBe(0);
  });

  it("fingerprints pack contents independent of order", () => {
    const a = packVersion([{ id: "x", version: 1 }, { id: "y", version: 2 }]);
    expect(packVersion([{ id: "y", version: 2 }, { id: "x", version: 1 }])).toBe(a);
    expect(packVersion([{ id: "x", version: 2 }, { id: "y", version: 2 }])).not.toBe(a);
  });
});

describe("request schemas", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("lets the diagnostic start without a scope, but not practice", () => {
    expect(startAttemptSchema.safeParse({ clientAttemptId: id, mode: "diagnostic" }).success).toBe(true);
    expect(startAttemptSchema.safeParse({ clientAttemptId: id, mode: "practice" }).success).toBe(false);
    expect(startAttemptSchema.safeParse({ clientAttemptId: id, mode: "recovery", skillId: id }).success).toBe(true);
    expect(startAttemptSchema.safeParse({ clientAttemptId: id, mode: "checkpoint", chapterId: id }).success).toBe(false);
  });

  it("validates study days", () => {
    expect(updateProfileSchema.safeParse({ studyDays: [1, 3, 5] }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ studyDays: [1, 1] }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ studyDays: [] }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ diagnosticStatus: "completed" }).success).toBe(false);
  });
});
