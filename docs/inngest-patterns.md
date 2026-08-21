# Inngest Patterns for ViralForge

> **Source:** Verified from inngest.com/docs (v4 SDK, August 2026)
> **Purpose:** Ground-truth reference. Read this BEFORE writing any background job or worker.

---

## 1. Client Setup

```ts
// lib/inngest/client.ts
import { Inngest } from "inngest";

// The `id` should match your app name
export const inngest = new Inngest({ id: "viralforge" });
```

## 2. Serve Handler (Next.js App Router)

```ts
// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";

// Import ALL your functions here
import { analyzeProject } from "@/lib/inngest/functions/analyze-project";
import { generateIdeas } from "@/lib/inngest/functions/generate-ideas";
import { generateMedia } from "@/lib/inngest/functions/generate-media";
import { publishScheduledPosts } from "@/lib/inngest/functions/publish-scheduled";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    analyzeProject,
    generateIdeas,
    generateMedia,
    publishScheduledPosts,
  ],
});
```

## 3. Event-Triggered Function

Use for: "something happened, process it in the background."

```ts
// lib/inngest/functions/generate-ideas.ts
import { inngest } from "../client";

// Define your event types for type safety
type GenerateIdeasEvent = {
  data: {
    project_id: string;
    profile_id: string;
    count: number;
  };
};

export const generateIdeas = inngest.createFunction(
  {
    id: "generate-content-ideas",
    // Trigger: fires when this event is sent
    triggers: { event: "app/generate-ideas" },
  },
  async ({ event, step }) => {
    // Step 1: Load the content profile
    const profile = await step.run("load-profile", async () => {
      // Supabase query here
      return { /* profile data */ };
    });

    // Step 2: Call Gemini API to generate ideas
    const ideas = await step.run("call-gemini", async () => {
      // Gemini API call here
      return [/* array of ideas */];
    });

    // Step 3: Save ideas to database
    await step.run("save-ideas", async () => {
      // Supabase insert here
    });

    return { generated: ideas.length };
  }
);
```

## 4. Cron/Scheduled Function

Use for: "run this on a schedule" (e.g., check for due posts every minute).

```ts
// lib/inngest/functions/publish-scheduled.ts
import { inngest } from "../client";

export const publishScheduledPosts = inngest.createFunction(
  {
    id: "publish-scheduled-posts",
    // Cron trigger: runs every minute
    triggers: { cron: "* * * * *" },
  },
  async ({ step }) => {
    // Step 1: Claim posts that are due
    const claimedPosts = await step.run("claim-due-posts", async () => {
      // UPDATE scheduled_posts 
      // SET status = 'publishing', claimed_at = NOW()
      // WHERE status = 'scheduled' AND scheduled_for <= NOW()
      // RETURNING id
      return [/* posts */];
    });

    if (claimedPosts.length === 0) {
      return { published: 0 };
    }

    // Step 2: Fan out - send an event for each claimed post
    await step.sendEvent(
      "fan-out-publish",
      claimedPosts.map((post) => ({
        name: "viralforge/post.publish",
        data: { post_id: post.id },
      }))
    );

    return { queued: claimedPosts.length };
  }
);
```

## 5. Cron with Timezone

```ts
export const weeklyDigest = inngest.createFunction(
  {
    id: "weekly-digest",
    triggers: { cron: "TZ=America/New_York 0 9 * * 1" }, // Monday 9am ET
  },
  async ({ step }) => {
    // ...
  }
);
```

## 6. Cron with Jitter (Avoid Thundering Herd)

```ts
export const hourlySync = inngest.createFunction(
  {
    id: "hourly-sync",
    triggers: [{ cron: "0 * * * *", jitter: "5m" }],
  },
  async ({ step }) => {
    // Fires at a random time within 5 minutes after each hour
  }
);
```

## 7. Step Primitives

### step.run() — Execute retriable code
```ts
const result = await step.run("step-name", async () => {
  // This code is retried if it throws an error.
  // Its result is memoized (saved) to prevent re-execution.
  return { data: "value" };
});
```

### step.sleep() — Pause execution
```ts
await step.sleep("wait-before-retry", "30s");  // 30 seconds
await step.sleep("wait-a-bit", "5m");          // 5 minutes
await step.sleep("wait-longer", "1h");         // 1 hour
await step.sleep("wait-a-day", "1d");          // 1 day
```

### step.sendEvent() — Trigger other functions
```ts
// Send a single event
await step.sendEvent("trigger-generation", {
  name: "app/generate-media",
  data: { asset_id: "abc123" },
});

// Send multiple events (fan-out pattern)
await step.sendEvent("fan-out", [
  { name: "app/generate-media", data: { asset_id: "1" } },
  { name: "app/generate-media", data: { asset_id: "2" } },
]);
```

## 8. Sending Events from Your App

```ts
// From a Server Action or API Route:
import { inngest } from "@/lib/inngest/client";

export async function generateContent(projectId: string) {
  await inngest.send({
    name: "app/generate-ideas",
    data: {
      project_id: projectId,
      profile_id: "...",
      count: 5,
    },
  });
}
```

## 9. Error Handling & Retries

```ts
export const riskyFunction = inngest.createFunction(
  {
    id: "risky-operation",
    triggers: { event: "viralforge/risky.start" },
    retries: 3,  // retry up to 3 times (default is 4)
  },
  async ({ event, step }) => {
    try {
      await step.run("external-api-call", async () => {
        // If this throws, the STEP is retried (not the whole function)
        try {
          const res = await fetch("https://api.external.com/generate", {
            signal: AbortSignal.timeout(5000)
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          return await res.json();
        } catch (error: any) {
          if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            throw new Error('API timeout: request took over 5000ms');
          }
          throw error;
        }
      });
    } catch (error) {
      // After all retries exhausted, handle gracefully
      await step.run("mark-failed", async () => {
        // Update status to "failed" in database
      });
    }
  }
);
```

## 10. Flow Control (Throttle, Rate Limit, Debounce)

```ts
export const throttledFunction = inngest.createFunction(
  {
    id: "rate-limited-api-call",
    triggers: { event: "viralforge/api.call" },
    // Only allow 3 executions per minute
    throttle: { limit: 3, period: "1min" },
  },
  async ({ step }) => {
    // ...
  }
);
```

---

## ViralForge-Specific Event Names

Use these consistent event names across the app:

| Event Name | Triggered When | Handler |
|------------|---------------|---------|
| `app/analyze-project` | User creates project | `analyzeProject` function |
| `app/generate-ideas` | User clicks "Generate Ideas" | `generateIdeas` function |
| `app/generate-media` | User approves an idea | `generateMedia` function |
| `viralforge/post.publish` | Cron finds a due post | `publishScheduledPosts` function |

## Installation

```bash
npm install inngest
```

## Dev Server

Run the Inngest dev server locally to test background jobs:

```bash
npx inngest-cli@latest dev
```

Then start your Next.js app. The Inngest dev server auto-discovers functions at `http://localhost:3000/api/inngest`.

## Key Rules

1. **Every step.run() is independently retried** - if step 3 fails, steps 1 and 2 are NOT re-executed (their results are memoized).
2. **Always name your steps** - the string name is the memoization key.
3. **Keep control flow deterministic** - place external I/O inside `step.run()` callbacks, and ensure retried writes are idempotent.
4. **Use fan-out for parallel work** - don't loop through items in one function; send events and let separate function instances handle each item.
5. **The serve handler exports GET, POST, PUT** - all three are required for the Inngest SDK to work with Next.js.
