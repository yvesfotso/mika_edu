import { describe, expect, it } from "vitest";
import {
  activeSubjectIds,
  canChangeProgram,
  mentionFor,
  normalizeProgramSettings,
  programConfigSchema,
  ProgramSettingsError,
  type ProgramConfig,
} from "./program";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

const gceA: ProgramConfig = { kind: "grades", grades: ["A", "B", "C", "D", "E"], passGrades: ["A", "B", "C", "D", "E"], minSubjects: 2, maxSubjects: 3 };
const bac: ProgramConfig = {
  kind: "average",
  scale: 20,
  passMark: 10,
  mentions: [
    { min: 12, label: { fr: "Assez bien" } },
    { min: 14, label: { fr: "Bien" } },
    { min: 10, label: { fr: "Passable" } },
  ],
};

describe("program settings", () => {
  it("validates grade-based programs: subject count, track membership and grades", () => {
    expect(normalizeProgramSettings(gceA, [A, B, C], { subjects: [A, B], targetGrades: { [A]: "A", [C]: "B" } })).toEqual({
      subjects: [A, B],
      targetGrades: { [A]: "A" },
    });
    expect(() => normalizeProgramSettings(gceA, [A, B, C], { subjects: [A] })).toThrow(ProgramSettingsError);
    expect(() => normalizeProgramSettings(gceA, [A, B], { subjects: [A, C] })).toThrow(/not part of your track/);
    expect(() => normalizeProgramSettings(gceA, [A, B], { subjects: [A, B], targetGrades: { [A]: "Z" } })).toThrow(/Unknown grade/);
  });

  it("validates average-based programs and ignores subject choices", () => {
    expect(normalizeProgramSettings(bac, [A, B], { targetAverage: 14.3, subjects: [A] })).toEqual({ targetAverage: 14.5 });
    expect(() => normalizeProgramSettings(bac, [A, B], { targetAverage: 8 })).toThrow(/between 10 and 20/);
  });

  it("limits active subjects to the learner's choice only for grade-based programs", () => {
    expect(activeSubjectIds(gceA, [A, B, C], { subjects: [C, A] })).toEqual([A, C]);
    expect(activeSubjectIds(gceA, [A, B, C], null)).toEqual([A, B, C]);
    expect(activeSubjectIds(bac, [A, B, C], { subjects: [A] })).toEqual([A, B, C]);
  });

  it("finds the mention an average reaches", () => {
    expect(mentionFor(bac, 14.5)?.fr).toBe("Bien");
    expect(mentionFor(bac, 12)?.fr).toBe("Assez bien");
    expect(mentionFor(bac, 9)).toBeNull();
    expect(mentionFor(gceA, 15)).toBeNull();
  });

  it("locks the exam for students after onboarding only", () => {
    expect(canChangeProgram(false, "student")).toBe(true);
    expect(canChangeProgram(true, "student")).toBe(false);
    expect(canChangeProgram(true, "admin")).toBe(true);
  });

  it("parses stored configs", () => {
    expect(programConfigSchema.parse(gceA)).toEqual(gceA);
    expect(programConfigSchema.safeParse({ kind: "grades", grades: [] }).success).toBe(false);
  });
});
