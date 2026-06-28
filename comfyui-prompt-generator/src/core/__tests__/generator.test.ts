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

describe("convert -> structured (qwen, default)", () => {
  const r = convert(PARAGRAPH, { target: "qwen", addQualityTags: true });

  it("uses structured style by default for qwen", () => {
    expect(r.styleUsed).toBe("structured");
  });

  it("emits labeled categories on separate lines", () => {
    expect(r.positive).toMatch(/^Subject: /m);
    expect(r.positive).toMatch(/^Clothing: leather jacket$/m);
    expect(r.positive).toMatch(/^Environment: /m);
    expect(r.positive.split("\n").length).toBeGreaterThan(3);
  });

  it("does not use booru count tokens like 1girl in structured output", () => {
    expect(r.positive).not.toContain("1girl");
  });

  it("appends the official Qwen positive magic when quality is on", () => {
    expect(r.positive).toContain("Ultra HD, 4K, cinematic composition");
  });

  it("does not generate a negative prompt by default", () => {
    expect(r.negative).toBe("");
  });
});

describe("convert -> prose (forced natural)", () => {
  const r = convert(PARAGRAPH, { target: "qwen", style: "natural" });

  it("produces a single sentence ending in punctuation", () => {
    expect(/[.!?]$/.test(r.positive)).toBe(true);
    expect(r.positive[0]).toBe(r.positive[0].toUpperCase());
    expect(r.positive).not.toContain("\n");
  });

  it("includes clothing as a 'wearing' clause", () => {
    expect(r.positive.toLowerCase()).toContain("wearing");
    expect(r.positive.toLowerCase()).toContain("leather jacket");
  });
});

describe("literal text rendering", () => {
  it("captures double-quoted text and preserves casing", () => {
    const r = convert('a neon sign reading "OPEN 24 Hours" on a wall', {
      target: "qwen",
    });
    expect(r.positive).toContain('Text: "OPEN 24 Hours"');
  });

  it("surfaces quoted text in natural mode too", () => {
    const r = convert('a poster that says "SALE"', {
      target: "flux",
    });
    expect(r.positive).toContain('with the text "SALE"');
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

  it("provides a real qwen negative when explicitly requested", () => {
    const r = convert("a girl", { target: "qwen", includeNegative: true });
    expect(r.negative).toContain("blurry");
  });

  it("adds portrait-specific negatives when a person is present", () => {
    const r = convert("a 30-year-old man in a suit", {
      target: "qwen",
      includeNegative: true,
    });
    expect(r.negative).toContain("deformed hands");
  });

  it("adds text-specific negatives when literal text is present", () => {
    const r = convert('a poster reading "HELLO"', {
      target: "qwen",
      includeNegative: true,
    });
    expect(r.negative).toContain("garbled letters");
  });

  it("does not add portrait negatives for a person-less scene", () => {
    const r = convert("a diamond ring on black velvet", {
      target: "qwen",
      includeNegative: true,
    });
    expect(r.negative).not.toContain("deformed hands");
  });

  it("captures explicit ages into the subject", () => {
    const r = convert("portrait of a 45-year-old executive in a navy blazer", {
      target: "qwen",
    });
    expect(r.positive).toContain("45-year-old");
  });

  it("humanizes plural counts in structured output", () => {
    const r = convert("two women walking in a park", { target: "qwen" });
    expect(r.positive).toContain("two women");
  });
});
