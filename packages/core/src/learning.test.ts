import { describe, expect, it } from "vitest";
import { addDays, daysUntil, localDate } from "./dates";
import { localize } from "./i18n";
import { EMPTY_MASTERY, retainedScore, updateMastery, type MasteryEvidence } from "./mastery";
import { recommendChapters, weightedMastery } from "./recommend";
import { displayedStreak, recordActivity } from "./streak";
import { canEdit, canTransition } from "./workflow";

const now = new Date("2026-05-01T12:00:00Z");
const right = (difficulty = 3): MasteryEvidence => ({ correct: true, difficulty, mode: "practice" });
const wrong = (difficulty = 3): MasteryEvidence => ({ correct: false, difficulty, mode: "practice" });

describe("mastery", () => {
  it("rises with correct answers and falls with wrong ones", () => {
    const up = updateMastery(EMPTY_MASTERY, [right(), right(), right()], now);
    expect(up.score).toBeGreaterThan(0.5);
    const down = updateMastery(up, [wrong(), wrong()], now);
    expect(down.score).toBeLessThan(up.score);
    expect(down.attemptsCount).toBe(5);
    expect(down.confidence).toBeGreaterThan(up.confidence);
  });

  it("gives less credit for hinted or slow answers", () => {
    const clean = updateMastery(EMPTY_MASTERY, [right()], now);
    const hinted = updateMastery(EMPTY_MASTERY, [{ ...right(), hintsUsed: 2 }], now);
    const slow = updateMastery(EMPTY_MASTERY, [{ ...right(), responseMs: 10 * 60 * 1000 }], now);
    expect(hinted.score).toBeLessThan(clean.score);
    expect(slow.score).toBeLessThan(clean.score);
  });

  it("weighs harder questions and mock exams more", () => {
    const easy = updateMastery(EMPTY_MASTERY, [right(1)], now);
    const hard = updateMastery(EMPTY_MASTERY, [right(5)], now);
    const mock = updateMastery(EMPTY_MASTERY, [{ ...right(1), mode: "mock" }], now);
    expect(hard.score).toBeGreaterThan(easy.score);
    expect(mock.score).toBeGreaterThan(easy.score);
  });

  it("decays with time but never below the retention floor", () => {
    const state = { score: 0.9, confidence: 0.5, attemptsCount: 10, lastPracticedAt: now };
    expect(retainedScore(state, now)).toBe(0.9);
    const later = new Date(now.getTime() + 45 * 86_400_000);
    expect(retainedScore(state, later)).toBeCloseTo(0.9 * 0.8, 3);
    const muchLater = new Date(now.getTime() + 3650 * 86_400_000);
    expect(retainedScore(state, muchLater)).toBeGreaterThanOrEqual(0.9 * 0.6 - 0.001);
  });
});

describe("streaks", () => {
  it("extends on consecutive days and resets after a gap", () => {
    let s = recordActivity({ currentDays: 0, bestDays: 0, lastActivityDate: null }, "2026-05-01");
    s = recordActivity(s, "2026-05-01");
    s = recordActivity(s, "2026-05-02");
    expect(s).toEqual({ currentDays: 2, bestDays: 2, lastActivityDate: "2026-05-02" });
    s = recordActivity(s, "2026-05-05");
    expect(s).toEqual({ currentDays: 1, bestDays: 2, lastActivityDate: "2026-05-05" });
  });

  it("ignores late-syncing older activity", () => {
    const s = { currentDays: 4, bestDays: 4, lastActivityDate: "2026-05-10" };
    expect(recordActivity(s, "2026-05-08")).toBe(s);
  });

  it("shows a broken streak as zero", () => {
    const s = { currentDays: 4, bestDays: 6, lastActivityDate: "2026-05-10" };
    expect(displayedStreak(s, "2026-05-10")).toEqual({ currentDays: 4, activeToday: true });
    expect(displayedStreak(s, "2026-05-11")).toEqual({ currentDays: 4, activeToday: false });
    expect(displayedStreak(s, "2026-05-12")).toEqual({ currentDays: 0, activeToday: false });
  });
});

describe("dates", () => {
  it("uses the learner's timezone for calendar dates", () => {
    const lateEvening = new Date("2026-05-01T23:30:00Z");
    expect(localDate(lateEvening, "Africa/Douala")).toBe("2026-05-02");
    expect(localDate(lateEvening, "UTC")).toBe("2026-05-01");
    expect(localDate(lateEvening, "Not/AZone")).toBe("2026-05-02");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-03-01", -41)).toBe("2026-01-19");
  });

  it("counts days until the exam", () => {
    expect(daysUntil("2026-06-10", now)).toBe(40);
    expect(daysUntil(null, now)).toBeNull();
  });
});

describe("recommendations", () => {
  it("prioritises weak chapters in high-coefficient subjects, then unstarted ones", () => {
    const practiced = (score: number) => ({ score, confidence: 0.5, attemptsCount: 10, lastPracticedAt: now });
    const recs = recommendChapters(
      [
        { chapterId: "mastered", subjectId: "m", coefficient: 5, orderIndex: 0, hasQuestions: true, mastery: practiced(0.95) },
        { chapterId: "weak-high", subjectId: "m", coefficient: 5, orderIndex: 1, hasQuestions: true, mastery: practiced(0.3) },
        { chapterId: "weak-low", subjectId: "h", coefficient: 1, orderIndex: 0, hasQuestions: true, mastery: practiced(0.3) },
        { chapterId: "new", subjectId: "m", coefficient: 5, orderIndex: 2, hasQuestions: true, mastery: null },
        { chapterId: "empty", subjectId: "m", coefficient: 5, orderIndex: 3, hasQuestions: false, mastery: null },
      ],
      now,
      5,
    );
    expect(recs.map((r) => r.chapterId)).toEqual(["weak-high", "new", "weak-low"]);
  });

  it("weights overall mastery by coefficient", () => {
    expect(weightedMastery([{ mastery: 1, coefficient: 3 }, { mastery: 0, coefficient: 1 }])).toBe(0.75);
    expect(weightedMastery([])).toBe(0);
  });
});

describe("workflow", () => {
  it("enforces the review chain", () => {
    expect(canTransition("draft", "review", "teacher")).toBe(true);
    expect(canTransition("review", "approved", "teacher")).toBe(false);
    expect(canTransition("review", "approved", "reviewer")).toBe(true);
    expect(canTransition("approved", "published", "reviewer")).toBe(false);
    expect(canTransition("approved", "published", "admin")).toBe(true);
    expect(canTransition("draft", "published", "admin")).toBe(false);
    expect(canEdit("published", "teacher")).toBe(false);
    expect(canEdit("draft", "student")).toBe(false);
  });
});

describe("localize", () => {
  it("falls back to another language when a translation is missing", () => {
    expect(localize({ en: "Algebra", fr: "Algèbre" }, "fr")).toBe("Algèbre");
    expect(localize({ en: "Algebra", fr: "" }, "fr")).toBe("Algebra");
    expect(localize(null, "en")).toBe("");
  });
});
