import { describe, it, expect, vi } from "vitest";
import { resolveToUtc } from "@/lib/time";
import { schedulePost } from "./schedule-actions";

const { insertSpy, supabaseMock } = vi.hoisted(() => {
  const insertSpy = vi.fn(async () => ({ error: null }));
  const row = (data: unknown) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data }),
        }),
      }),
    }),
  });
  const supabaseMock = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (table: string) =>
      table === "scheduled_posts"
        ? { insert: insertSpy }
        : table === "projects"
          ? row({ user_id: "user-1" })
          : row({ id: "asset-1" }),
  };
  return { insertSpy, supabaseMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => supabaseMock,
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

describe("resolveToUtc (scheduler timezone conversion)", () => {
  it("converts a normal wall time to UTC", () => {
    // 2026-01-15 12:00 America/New_York = 17:00 UTC (EST, -5)
    expect(resolveToUtc("2026-01-15T12:00", "America/New_York")).toBe("2026-01-15T17:00:00.000Z");
  });

  it("handles DST-forward spring (nonexistent wall time) explicitly", () => {
    // 2026-03-08 02:30 America/New_York does not exist (clocks jump 02:00->03:00).
    // Resolution must converge or reject, not silently shift.
    const r = resolveToUtc("2026-03-08T02:30", "America/New_York");
    if (r !== null) {
      // If it resolves, it must land on a valid instant whose wall time is 03:30.
      expect(new Date(r).getUTCHours()).toBe(7); // 03:30 EDT = 07:30 UTC
    }
  });

  it("handles DST-fall back ambiguously by picking the earlier instant", () => {
    // 2026-11-01 01:30 America/New_York occurs twice. Code picks the first (EDT, -4).
    expect(resolveToUtc("2026-11-01T01:30", "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
  });

  it("rejects impossible calendar dates (2027-02-29 regression)", () => {
    // Date.UTC normalizes 2027-02-29 to 2027-03-01; resolution must reject,
    // never return a shifted instant whose wall time differs from the request.
    expect(resolveToUtc("2027-02-29T12:00", "UTC")).toBeNull();
    expect(resolveToUtc("2027-02-29T12:00", "America/New_York")).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(resolveToUtc("2028-02-29T12:00", "UTC")).toBe("2028-02-29T12:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(resolveToUtc("", "UTC")).toBeNull();
    expect(resolveToUtc("garbage", "UTC")).toBeNull();
    expect(resolveToUtc("2026-01-15T12:00", "Not/AZone")).toBeNull();
  });
});

describe("schedulePost (server action)", () => {
  it("does not persist an impossible calendar date such as 2027-02-29", async () => {
    const formData = new FormData();
    formData.set("assetId", "asset-1");
    formData.set("projectId", "project-1");
    formData.set("platform", "instagram");
    formData.set("localDatetime", "2027-02-29T12:00");
    formData.set("timezone", "UTC");

    const result = (await schedulePost(null, formData)) as { error?: string };

    expect(result.error).toMatch(/Invalid date\/time/);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
