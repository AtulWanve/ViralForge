import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";

export const publishScheduledPosts = inngest.createFunction(
  {
    id: "publish-scheduled-posts",
    triggers: { cron: "* * * * *" }, // Run every minute
  },
  async ({ step }) => {
    // 1. Claim posts that are due
    const claimedPosts = await step.run("claim-due-posts", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Claim posts atomically using RPC with FOR UPDATE SKIP LOCKED
      // This prevents race conditions when multiple workers run concurrently
      const { data, error } = await supabase
        .rpc("claim_scheduled_posts", { max_count: 100 }); // ponytail: raise or paginate if >100 posts/min becomes real

      if (error) throw new Error(error.message);
      return data || [];
    });

    if (claimedPosts.length === 0) {
      return { published: 0 };
    }

    // 2. Fan out - send an event for each claimed post
    await step.sendEvent(
      "fan-out-publish",
      claimedPosts.map((post: { id: string }) => ({
        name: "viralforge/post.publish",
        data: { post_id: post.id },
      }))
    );

    return { queued: claimedPosts.length };
  }
);
