import { describe, expect, it } from "vitest";
import { acceptsAnswersAt, isAnswerCorrect, mergeAnswers, scoreAttempt, type ScorableQuestion } from "./scoring";

const single: ScorableQuestion = {
  id: "q1",
  type: "single_choice",
  options: [
    { id: "a", isCorrect: false },
    { id: "b", isCorrect: true },
  ],
  numericAnswer: null,
  numericTolerance: null,
};
const multi: ScorableQuestion = {
  id: "q2",
  type: "multiple_choice",
  options: [
    { id: "a", isCorrect: true },
    { id: "b", isCorrect: false },
    { id: "c", isCorrect: true },
  ],
  numericAnswer: null,
  numericTolerance: null,
};
const numeric: ScorableQuestion = { id: "q3", type: "numeric", options: [], numericAnswer: 9.81, numericTolerance: 0.01 };

describe("isAnswerCorrect", () => {
  it("scores single choice", () => {
    expect(isAnswerCorrect(single, { questionId: "q1", selectedOptionIds: ["b"] })).toBe(true);
    expect(isAnswerCorrect(single, { questionId: "q1", selectedOptionIds: ["a"] })).toBe(false);
    expect(isAnswerCorrect(single, { questionId: "q1", selectedOptionIds: ["a", "b"] })).toBe(false);
    expect(isAnswerCorrect(single, { questionId: "q1" })).toBe(false);
  });

  it("requires the exact set for multiple choice", () => {
    expect(isAnswerCorrect(multi, { questionId: "q2", selectedOptionIds: ["c", "a"] })).toBe(true);
    expect(isAnswerCorrect(multi, { questionId: "q2", selectedOptionIds: ["a"] })).toBe(false);
    expect(isAnswerCorrect(multi, { questionId: "q2", selectedOptionIds: ["a", "b", "c"] })).toBe(false);
  });

  it("applies numeric tolerance", () => {
    expect(isAnswerCorrect(numeric, { questionId: "q3", numericValue: 9.815 })).toBe(true);
    expect(isAnswerCorrect(numeric, { questionId: "q3", numericValue: 9.9 })).toBe(false);
    const exact = { ...numeric, numericAnswer: 0.3, numericTolerance: null };
    expect(isAnswerCorrect(exact, { questionId: "q3", numericValue: 0.1 + 0.2 })).toBe(true);
  });
});

describe("scoreAttempt", () => {
  it("counts correct answers and ignores foreign question ids", () => {
    const summary = scoreAttempt(
      [single, multi, numeric],
      [
        { questionId: "q1", selectedOptionIds: ["b"] },
        { questionId: "q2", selectedOptionIds: ["a"] },
        { questionId: "not-in-attempt", selectedOptionIds: ["x"] },
      ],
    );
    expect(summary.score).toBe(1);
    expect(summary.maxScore).toBe(3);
    expect(summary.percentage).toBe(33.3);
    expect(summary.results.map((r) => r.answered)).toEqual([true, true, false]);
  });

  it("handles empty attempts", () => {
    expect(scoreAttempt([], []).percentage).toBe(0);
  });
});

describe("mock deadlines", () => {
  const deadline = new Date("2026-06-01T10:00:00Z");
  it("accepts answers inside the grace period only", () => {
    expect(acceptsAnswersAt(deadline, new Date("2026-06-01T10:00:20Z"))).toBe(true);
    expect(acceptsAnswersAt(deadline, new Date("2026-06-01T10:01:00Z"))).toBe(false);
    expect(acceptsAnswersAt(null, new Date("2030-01-01T00:00:00Z"))).toBe(true);
  });

  it("lets newer answers replace saved ones", () => {
    const merged = mergeAnswers(
      [{ questionId: "q1", selectedOptionIds: ["a"] }, { questionId: "q2", selectedOptionIds: ["b"] }],
      [{ questionId: "q1", selectedOptionIds: ["b"] }],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((a) => a.questionId === "q1")?.selectedOptionIds).toEqual(["b"]);
  });
});
