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

  it("captures camera and material into their own structured lines", () => {
    const r = convert(
      "a diamond ring on black velvet, macro lens, chrome finish, shot on Canon",
      { target: "qwen" },
    );
    expect(r.positive).toMatch(/^Camera: .*macro lens/m);
    expect(r.positive).toMatch(/^Material: /m);
  });
});

describe("ltx video target", () => {
  const PROMPT =
    "A samurai walking through a foggy bamboo forest at dawn, slow dolly in, " +
    "handheld camera, cinematic.";

  it("defaults to natural prose in multiple sentences", () => {
    const r = convert(PROMPT, { target: "ltx" });
    expect(r.styleUsed).toBe("natural");
    expect(r.positive).not.toContain("\n");
    expect(r.positive.split(". ").length).toBeGreaterThanOrEqual(2);
  });

  it("uses the first pose as a present-tense main verb", () => {
    const r = convert(PROMPT, { target: "ltx" });
    expect(r.positive).toMatch(/A samurai .*walks in a/);
  });

  it("renders camera movement as verb clauses", () => {
    const r = convert(PROMPT, { target: "ltx" });
    expect(r.positive).toContain("The camera slowly dollies in");
    expect(r.positive).toContain("handheld");
  });

  it("anchors camera motion even when none is described", () => {
    const r = convert("a knight in a castle", { target: "ltx" });
    expect(r.positive).toContain("The camera slowly pushes in.");
  });

  it("uses pronouns for follow-up actions", () => {
    const r = convert("a woman standing on a cliff, looking back, smiling", {
      target: "ltx",
    });
    expect(r.positive).toContain("A woman");
    expect(r.positive).toMatch(/She .*smiles\./);
  });

  it("treats slow motion as temporal, not a camera move", () => {
    const r = convert("a dog running on a beach, slow motion", { target: "ltx" });
    expect(r.positive).toContain("The scene plays out in slow motion.");
    expect(r.positive).toContain("The camera slowly pushes in.");
  });

  it("lets creature content carry the scene with mature enabled", () => {
    const r = convert("a monster lurking in a cave, snarling, fog", {
      target: "ltx",
      includeNsfw: true,
    });
    expect(r.positive).toMatch(/^A monster lurks in a cave/);
    expect(r.positive).toContain("It snarls.");
  });

  it("picks the user's first-written action as the main verb", () => {
    const r = convert("a man running through a field, then jumping", { target: "ltx" });
    expect(r.positive).toMatch(/A man runs in a field/);
    expect(r.positive).toContain("He jumps.");
  });

  it("merges hair descriptors into one phrase in video prose", () => {
    const r = convert("a woman with long black hair standing on a beach", {
      target: "ltx",
    });
    expect(r.positive).toContain("long black hair");
    expect(r.positive).not.toContain("long hair and");
  });

  it("builds creature subjects as modifiers + noun", () => {
    const r = convert("a grotesque biomechanical creature crouching in a cave", {
      target: "ltx",
      includeNsfw: true,
    });
    expect(r.positive).toMatch(/^A grotesque, biomechanical creature crouches/);
    expect(r.positive).not.toContain("The scene shows creature");
  });

  it("uses the official LTX negative when requested", () => {
    const r = convert(PROMPT, { target: "ltx", includeNegative: true });
    expect(r.negative).toContain("motion artifacts");
    expect(r.negative).toContain("static");
  });

  it("classifies camera moves into the motion category", () => {
    const r = convert(PROMPT, { target: "qwen" });
    expect(r.positive).toMatch(/^Motion: slow dolly in, handheld camera$/m);
  });
});

describe("qwen turbo target", () => {
  it("shares qwen structured output and positive magic", () => {
    const r = convert("a woman in a red dress in a garden", {
      target: "qwenTurbo",
      addQualityTags: true,
    });
    expect(r.styleUsed).toBe("structured");
    expect(r.positive).toMatch(/^Subject: /m);
    expect(r.positive).toContain("Ultra HD, 4K, cinematic composition");
  });

  it("never emits a negative (cfg-distilled, inert)", () => {
    const r = convert("a woman in a red dress", {
      target: "qwenTurbo",
      includeNegative: true,
    });
    expect(r.negative).toBe("");
  });
});

describe("mature / horror content gating", () => {
  it("ignores horror vocabulary unless opted in", () => {
    const off = convert("a zombie with gore in a haunted forest", { target: "qwen" });
    expect(off.positive.toLowerCase()).not.toContain("zombie");
  });

  it("includes horror vocabulary when opted in", () => {
    const on = convert("a zombie with gore in a haunted forest", {
      target: "qwen",
      includeNsfw: true,
    });
    expect(on.positive).toContain("Content:");
    expect(on.positive.toLowerCase()).toContain("zombie");
  });

  it("emits mature content inline for tag targets", () => {
    const r = convert("a grotesque monster, body horror", {
      target: "sdxl",
      includeNsfw: true,
    });
    expect(r.positive.toLowerCase()).toContain("monster");
    expect(r.positive.toLowerCase()).toContain("body horror");
  });

  it("humanizes plural counts in structured output", () => {
    const r = convert("two women walking in a park", { target: "qwen" });
    expect(r.positive).toContain("two women");
  });
});
