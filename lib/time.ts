export function offsetAt(timezone: string, instantMs: number): number | null {
  try {
    const local = wallParts(instantMs, timezone);
    const utc = wallParts(instantMs, "UTC");
    if (!local || !utc) return null;
    const localMs = Date.UTC(local.y, local.m - 1, local.d, local.h, local.min);
    const utcMs = Date.UTC(utc.y, utc.m - 1, utc.d, utc.h, utc.min);
    return localMs - utcMs;
  } catch {
    return null;
  }
}

export function wallTime(instantMs: number, timezone: string): string | null {
  const p = wallParts(instantMs, timezone);
  if (!p) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

export function wallParts(instantMs: number, timezone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const raw: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(instantMs))) {
    if (p.type !== "literal") raw[p.type] = Number(p.value);
  }
  if (raw.hour === 24) raw.hour = 0;
  return {
    y: raw.year,
    m: raw.month,
    d: raw.day,
    h: raw.hour,
    min: raw.minute,
  };
}

export function resolveToUtc(localDatetime: string, timezone: string): string | null {
  const [datePart, timePart] = localDatetime.split("T");
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  let guess = Date.UTC(y, m - 1, d, h, min);
  if (Number.isNaN(guess)) return null;

  let lastCandidate: number | null = null;
  for (let i = 0; i < 3; i++) {
    const offset = offsetAt(timezone, guess);
    if (offset === null) return null;
    const candidate = guess - offset;
    if (wallTime(candidate, timezone) === localDatetime) {
      return new Date(candidate).toISOString();
    }
    if (candidate === lastCandidate) {
      // Candidate repeated while the wall-time check above already failed:
      // the requested local time cannot be represented (e.g. 2027-02-29
      // normalizes to March 1). Reject rather than return a shifted instant.
      // Real fall-back ambiguity is resolved by the successful-match return.
      return null;
    }
    lastCandidate = candidate;
    guess = candidate;
  }
  // Convergence failed for non-oscillating reason; reject.
  return null;
}
