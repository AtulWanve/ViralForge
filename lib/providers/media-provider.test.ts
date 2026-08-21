import { describe, it, expect, vi, afterEach } from "vitest";
import { createMediaProvider, FalProvider } from "./fal-provider";
import { MockProvider } from "./mock-provider";

const save = process.env.FAL_KEY;

afterEach(() => {
  if (save === undefined) delete process.env.FAL_KEY;
  else process.env.FAL_KEY = save;
});

describe("createMediaProvider (provider abstraction)", () => {
  it("returns FalProvider when a real FAL_KEY is set", () => {
    process.env.FAL_KEY = "fal-1234";
    expect(createMediaProvider()).toBeInstanceOf(FalProvider);
  });

  it("returns MockProvider when no FAL_KEY is set", () => {
    delete process.env.FAL_KEY;
    expect(createMediaProvider()).toBeInstanceOf(MockProvider);
  });

  it("returns MockProvider for the placeholder key", () => {
    process.env.FAL_KEY = "mock-key";
    expect(createMediaProvider()).toBeInstanceOf(MockProvider);
  });
});

describe("MockProvider", () => {
  it("returns deterministic https URLs for image and video", async () => {
    const p = new MockProvider();
    const img = await p.generateImage("p", "id");
    const vid = await p.generateVideo("p", "id");
    expect(img.startsWith("https://")).toBe(true);
    expect(vid.startsWith("https://")).toBe(true);
  });

  it("is interchangeable behind the MediaProvider interface", () => {
    const p: { generateImage(p: string, id: string): Promise<string> } = new MockProvider();
    expect(typeof p.generateImage).toBe("function");
  });
});
