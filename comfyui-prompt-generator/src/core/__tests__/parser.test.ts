import { describe, it, expect } from "vitest";
import { parse, normalize } from "../parser";

describe("normalize", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalize("A  RED   Jacket")).toBe("a red jacket");
  });
  it("expands contractions", () => {
    expect(normalize("she's smiling")).toBe("she is smiling");
  });
});

describe("parse", () => {
  it("splits 'long blonde hair' into length and color tags", () => {
    const { tags } = parse("a woman with long blonde hair");
    const texts = tags.map((t) => t.text);
    expect(texts).toContain("long hair");
    expect(texts).toContain("blonde hair");
  });

  it("extracts eye color", () => {
    const { tags } = parse("a man with blue eyes");
    expect(tags.map((t) => t.text)).toContain("blue eyes");
  });

  it("detects a single female subject as 1girl + solo", () => {
    const { tags } = parse("a young woman standing in a forest");
    const texts = tags.map((t) => t.text);
    expect(texts).toContain("1girl");
    expect(texts).toContain("solo");
    expect(texts).toContain("young woman");
  });

  it("detects plural subjects", () => {
    const { tags } = parse("two women walking");
    expect(tags.map((t) => t.text)).toContain("2girls");
  });

  it("classifies setting, time, lighting, style", () => {
    const { tags } = parse(
      "a city at night with neon lights, cinematic, photorealistic",
    );
    const byCat = (c: string) => tags.filter((t) => t.category === c).map((t) => t.text);
    expect(byCat("setting")).toContain("city");
    expect(byCat("timeWeather")).toContain("night");
    expect(byCat("lighting")).toContain("neon lights");
    expect(byCat("lighting")).toContain("cinematic lighting");
    expect(byCat("style")).toContain("photorealistic");
  });

  it("does not match substrings across word boundaries", () => {
    // 'cathedral' must not match 'cat'
    const { tags } = parse("a grand cathedral");
    expect(tags.map((t) => t.text)).not.toContain("cat");
  });

  it("dedupes repeated concepts", () => {
    const { tags } = parse("night, at night, nighttime");
    const nights = tags.filter((t) => t.text === "night");
    expect(nights).toHaveLength(1);
  });
});
