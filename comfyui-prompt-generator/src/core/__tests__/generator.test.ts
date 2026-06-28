import { describe, it, expect } from "vitest";
import { convert } from "../index";

const PARAGRAPH =
  "A young woman with long blonde hair stands in a rainy neon-lit city at " +
  "night, wearing a red leather jacket. The photo is cinematic and moody " +
  "with a shallow depth of field, photorealistic.";

describe("convert -> tags (sdxl)", () => {
  const r = convert(PARAGRAPH, { target: "sdxl", addQualityTags: true });

  it("uses tag style by default for sdxl", () => {
    expect(r.styleUsed).toBe("tags");
  });

  it("front-loads quality then subject count", () => {
    expect(r.positive.startsWith("masterpiece, best quality")).toBe(true);
    expect(r.positive).toContain("1girl");
  });

  it("emits booru-normalized hair tags", () => {
    expect(r.positive).toContain("long hair");
    expect(r.positive).toContain("blonde hair");
  });

  it("orders categories: subject before setting before lighting", () => {
    const p = r.positive;
    expect(p.indexOf("young woman")).toBeLessThan(p.indexOf("city"));
    expect(p.indexOf("city")).toBeLessThan(p.indexOf("cinematic lighting"));
  });
});

describe("convert -> prose (qwen)", () => {
  const r = convert(PARAGRAPH, { target: "qwen" });

  it("uses natural style by default for qwen", () => {
    expect(r.styleUsed).toBe("natural");
  });

  it("produces a sentence, not comma-separated boost tags", () => {
    expect(r.positive).not.toContain("masterpiece");
    expect(/[.!?]$/.test(r.positive)).toBe(true);
    expect(r.positive[0]).toBe(r.positive[0].toUpperCase());
  });

  it("includes clothing as a 'wearing' clause", () => {
    expect(r.positive.toLowerCase()).toContain("wearing");
    expect(r.positive.toLowerCase()).toContain("leather jacket");
  });

  it("does not generate a negative prompt by default for qwen", () => {
    expect(r.negative).toBe("");
  });
});

describe("weights and negatives", () => {
  it("wraps subject with weight when emphasizeSubject is set", () => {
    const r = convert("a knight in a castle", {
      target: "sdxl",
      emphasizeSubject: 1.2,
    });
    expect(r.positive).toContain("(knight:1.20)");
  });

  it("adds score tags in pony negative", () => {
    const r = convert("a girl", { target: "pony", includeNegative: true });
    expect(r.negative).toContain("score_4");
  });

  it("qwen negative stays empty even when requested (inert in workflow)", () => {
    const r = convert("a girl", { target: "qwen", includeNegative: true });
    expect(r.negative).toBe("");
  });
});
