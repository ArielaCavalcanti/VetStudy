import { describe, expect, it } from "vitest";
import { selectQuestions, scorePercent, type QuizQuestion } from "./quiz";

const q = (id: string, kind: "text" | "image"): QuizQuestion => ({
  id, kind, prompt: id, image_url: null, options: ["a", "b"], correct_index: 0, explanation: "", source_ref: null,
});
const pool = [q("t1", "text"), q("t2", "text"), q("i1", "image"), q("i2", "image")];

describe("selectQuestions", () => {
  it("traditional quiz uses only text questions", () => {
    expect(selectQuestions(pool, "text").every((x) => x.kind === "text")).toBe(true);
  });
  it("image quiz uses only image questions", () => {
    expect(selectQuestions(pool, "image").map((x) => x.kind)).toEqual(["image", "image"]);
  });
  it("mixed quiz uses both kinds", () => {
    expect(selectQuestions(pool, "mixed")).toHaveLength(4);
  });
  it("caps quiz at 10 questions", () => {
    const many = Array.from({ length: 25 }, (_, i) => q(`t${i}`, "text"));
    expect(selectQuestions(many, "text")).toHaveLength(10);
  });
});

describe("scorePercent", () => {
  it("rounds score", () => expect(scorePercent(2, 3)).toBe(67));
  it("handles empty quiz", () => expect(scorePercent(0, 0)).toBe(0));
});