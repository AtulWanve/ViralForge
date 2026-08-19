import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";

export const publishScheduledPosts = inngest.createFunction(
  {
    id: "publish-scheduled-posts",
    triggers: { cron: "* * * * *" }, // Run every minute
  },
  async ({ step }) => {
    // 1. Find due posts
    const duePosts = await step.run("find-due-posts", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("*")
        .eq("status", "scheduled")
        .lte("scheduled_for", new Date().toISOString());

      if (error) throw new Error(error.message);
      return data;
    });

    if (!duePosts || duePosts.length === 0) {
      return { published: 0 };
    }

    // 2. Process each post (mock publisher)
    const results = await step.run("publish-posts", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const publishResults = [];

      for (const post of duePosts) {
        // Mock delay for publishing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Mock 10% failure rate
        const isSuccess = Math.random() > 0.1;

        if (isSuccess) {
          await supabase
            .from("scheduled_posts")
            .update({ status: "published" })
            .eq("id", post.id);
          publishResults.push({ id: post.id, status: "success" });
        } else {
          await supabase
            .from("scheduled_posts")
            .update({ 
              status: "failed",
              publish_error: "Mock error: Social media API rate limit exceeded" 
            })
            .eq("id", post.id);
          publishResults.push({ id: post.id, status: "failed" });
        }
      }

      return publishResults;
    });

    return { processed: results.length, details: results };
  }
);
