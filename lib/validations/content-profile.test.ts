import { describe, it, expect } from "vitest";
import { contentProfileSchema } from "./content-profile";

const valid = {
  schemaVersion: 1,
  visual_style: "Clean desk setups with neon accents",
  hooks: ["Wait until the end...", "This changed my setup"],
  caption_structure: "Short hook, 3 bullets, CTA",
  format_mix: "70% reels, 30% carousels",
  content_pillars: ["Desk setups", "Productivity"],
};

describe("contentProfileSchema (analysis parser)", () => {
  it("accepts a valid LLM profile", () => {
    const r = contentProfileSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejects an unsupported schemaVersion", () => {
    const r = contentProfileSchema.safeParse({ ...valid, schemaVersion: 2 });
    expect(r.success).toBe(false);
  });

  it("rejects unversioned output (missing schemaVersion)", () => {
    const unversioned = { ...valid };
    delete (unversioned as any).schemaVersion;
    expect(contentProfileSchema.safeParse(unversioned).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const missing = { ...valid };
    delete (missing as any).visual_style;
    expect(contentProfileSchema.safeParse(missing).success).toBe(false);
  });

  it("rejects empty / whitespace hooks", () => {
    const r = contentProfileSchema.safeParse({ ...valid, hooks: ["  "] });
    expect(r.success).toBe(false);
  });

  it("rejects non-object / non-JSON input", () => {
    expect(contentProfileSchema.safeParse("[]").success).toBe(false);
    expect(contentProfileSchema.safeParse(null).success).toBe(false);
  });
});
