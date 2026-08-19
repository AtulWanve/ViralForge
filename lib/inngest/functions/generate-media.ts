import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";

export const generateMedia = inngest.createFunction(
  {
    id: "generate-media",
    triggers: { event: "viralforge/media.generate" },
  },
  async ({ event, step }) => {
    const { ideaId, projectId } = event.data;

    // 1. Fetch the idea
    const idea = await step.run("fetch-idea", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data, error } = await supabase
        .from("content_ideas")
        .select("*")
        .eq("id", ideaId)
        .single();

      if (error) throw new Error(error.message);
      return data;
    });

    // 2. Create the generated_asset record (status: queued)
    const asset = await step.run("create-asset-record", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data, error } = await supabase
        .from("generated_assets")
        .insert({
          project_id: projectId,
          idea_id: ideaId,
          type: idea.format,
          status: 'generating'
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    });

    // 3. Call fal.ai (mock for now, we'll implement actual fal.ai call later)
    const mediaUrl = await step.run("call-fal-ai", async () => {
      // MOCK implementation - just simulating a 3-second generation
      await new Promise(resolve => setTimeout(resolve, 3000));
      return `https://picsum.photos/seed/${ideaId}/800/800`;
    });

    // 4. Update asset status
    await step.run("update-asset-status", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error } = await supabase
        .from("generated_assets")
        .update({
          status: 'ready',
          media_url: mediaUrl
        })
        .eq("id", asset.id);

      if (error) throw new Error(error.message);
    });

    return { status: "success", assetId: asset.id };
  }
);
