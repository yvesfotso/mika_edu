import { describe, expect, it } from "vitest";
import { seededShuffle } from "./shuffle";

describe("seededShuffle", () => {
  const items = ["a", "b", "c", "d"];

  it("is a stable permutation for a given seed", () => {
    const once = seededShuffle(items, "attempt-1:q1");
    expect(seededShuffle(items, "attempt-1:q1")).toEqual(once);
    expect([...once].sort()).toEqual(items);
    expect(items).toEqual(["a", "b", "c", "d"]);
  });

  it("puts the first option first only about a quarter of the time", () => {
    let first = 0;
    for (let i = 0; i < 2000; i++) if (seededShuffle(items, `seed-${i}`)[0] === "a") first++;
    expect(first / 2000).toBeGreaterThan(0.18);
    expect(first / 2000).toBeLessThan(0.32);
  });
});
