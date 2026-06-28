import { describe, it, expect } from "vitest";
import { suggest, currentToken } from "../autocomplete";

describe("currentToken", () => {
  it("returns the word immediately before the caret", () => {
    const text = "a man with lea";
    const { token, start } = currentToken(text, text.length);
    expect(token).toBe("lea");
    expect(start).toBe(11);
  });
  it("stops at commas and newlines", () => {
    const text = "city, neon";
    expect(currentToken(text, text.length).token).toBe("neon");
  });
});

describe("suggest", () => {
  it("prefix matches win over substring matches", () => {
    const res = suggest("lea");
    expect(res[0].value).toMatch(/^lea/);
  });

  it("matches multiword phrases by word start", () => {
    const values = suggest("jacket").map((s) => s.value);
    expect(values).toContain("leather jacket");
  });

  it("matches via the canonical tag alias", () => {
    // keyword "cinematic" -> tag "cinematic lighting"; querying the tag works
    const tags = suggest("cinematic").map((s) => s.tag);
    expect(tags).toContain("cinematic lighting");
  });

  it("hides mature suggestions unless opted in", () => {
    expect(suggest("zombie").length).toBe(0);
    expect(suggest("zombie", { includeNsfw: true }).length).toBeGreaterThan(0);
  });

  it("respects the limit", () => {
    expect(suggest("a", { limit: 3 }).length).toBeLessThanOrEqual(3);
  });

  it("returns nothing for empty queries", () => {
    expect(suggest("")).toEqual([]);
  });
});
