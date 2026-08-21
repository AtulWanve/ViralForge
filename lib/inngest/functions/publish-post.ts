import type { ScheduledPost, GeneratedAsset, ContentIdea } from "../../../types/database";
import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import { publishToAyrshare, type AyrsharePostResult } from "../../providers/ayrshare-provider";

type PublishPostRow = ScheduledPost & {
  generated_assets: GeneratedAsset & {
    content_ideas: Pick<ContentIdea, "caption">;
  };
};

export const publishPost = inngest.createFunction(
  {
    id: "publish-post",
    triggers: { event: "viralforge/post.publish" },
  },
  async ({ event, step }) => {
    const { post_id } = event.data;

    let post: PublishPostRow;
    let providerResult: AyrsharePostResult;

    try {
      // Fetch full post details
      post = await step.run("fetch-post", async () => {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data, error } = await supabase
          .from("scheduled_posts")
          .select(`
            *,
            generated_assets!inner(
              media_url,
              content_ideas(caption)
            )
          `)
          .eq("id", post_id)
          .single();

        if (error) throw new Error(error.message);
        return data;
      });

      // Call Ayrshare provider
      providerResult = await step.run("publish-to-provider", async () => {
        const raw: string | null = post.generated_assets.media_url;
        const caption = post.generated_assets.content_ideas?.caption || "New post";

        // Carousel assets store a JSON-stringified string[]; parse it so all
        // slide URLs are sent to Ayrshare. Plain URL strings are passed as-is.
        let mediaUrl: string | string[] | null = raw;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) mediaUrl = parsed as string[];
          } catch {
            // not JSON — plain URL, leave mediaUrl as raw string
          }
        }

        return publishToAyrshare(post.platform, mediaUrl ?? "", caption, post.id);
      });
    } catch (err: any) {
      // Mark failure
      await step.run("mark-failed", async () => {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error } = await supabase
          .from("scheduled_posts")
          .update({
            status: "failed",
            publish_error: err.message || "Unknown error",
            updated_at: new Date().toISOString()
          })
          .eq("id", post_id);

        if (error) throw new Error(error.message);
      });

      throw err; // Re-throw for Inngest retry/failure handling
    }

    // Mark success (outside try/catch so mark-failed never overwrites a published post)
    await step.run("mark-success", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error } = await supabase
        .from("scheduled_posts")
        .update({
          status: "published",
          updated_at: new Date().toISOString()
        })
        .eq("id", post_id);

      if (error) throw new Error(error.message);
    });

    return { success: true, result: providerResult };
  }
);