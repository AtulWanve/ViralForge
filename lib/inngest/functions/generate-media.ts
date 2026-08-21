import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";

export const generateMedia = inngest.createFunction(
  {
    id: "generate-media",
    triggers: { event: "app/generate-media" },
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
        .eq("project_id", projectId)
        .single();

      if (error) throw new Error(error.message);
      return data;
    });

    const assetType =
      idea.format === "video"
        ? "video"
        : idea.format === "carousel"
          ? "carousel"
          : "image";

    const prompt = idea.visual_prompt?.trim() || idea.caption?.trim();
    if (!prompt) {
      throw new Error("Media generation requires a prompt");
    }

    // 2. Create the generated_asset record (status: generating)
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
          type: assetType,
          status: 'generating'
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    });

    // 3. Generate media via fal.ai
    let mediaUrl: string;
    try {
      if (assetType === "video") {
        const { createMediaProvider } = await import("../../providers/fal-provider");
        const { uploadVideoToSupabase } = await import("../../post-processing");
        const provider = createMediaProvider();

        const url = await step.run("generate-video", async () =>
          provider.generateVideo(prompt, ideaId)
        );
        mediaUrl = await step.run("upload-video", async () =>
          uploadVideoToSupabase(url, projectId, asset.id)
        );
      } else if (assetType === "carousel") {
        const { createMediaProvider } = await import("../../providers/fal-provider");
        const { applyPostProcessing } = await import("../../post-processing");
        const { splitCarouselPrompts } = await import("../../gemini");
        const provider = createMediaProvider();

        const slides = await step.run("split-carousel", async () =>
          splitCarouselPrompts(prompt, 3)
        );

        const urls: string[] = [];
        for (let i = 0; i < slides.length; i++) {
          const slide = slides[i];
          const raw = await step.run(`generate-slide-${i}`, async () =>
            provider.generateImage(slide.visual_prompt, `${ideaId}-${i}`)
          );
          const url = await step.run(`process-slide-${i}`, async () =>
            applyPostProcessing(raw, slide.copy || idea.hook || "", projectId, `${asset.id}-${i}`)
          );
          urls.push(url);
        }

        mediaUrl = JSON.stringify(urls);
      } else {
        // image (default)
        const { createMediaProvider } = await import("../../providers/fal-provider");
        const { applyPostProcessing } = await import("../../post-processing");
        const provider = createMediaProvider();

        const url = await step.run("generate-image", async () =>
          provider.generateImage(prompt, ideaId)
        );
        mediaUrl = await step.run("process-image", async () =>
          applyPostProcessing(url, idea.hook || "", projectId, asset.id)
        );
      }
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Media generation failed:", error);

      const safeReason = /rate.?limit/i.test(rawMessage)
        ? "Rate limit hit while generating media"
        : /invalid|denied|unauthorized|unsupported/i.test(rawMessage)
          ? "Provider rejected the media generation request"
          : "Media generation failed";

      await step.run("mark-failed", async () => {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: updateError } = await supabase
          .from("generated_assets")
          .update({ status: 'failed', error_message: safeReason })
          .eq("id", asset.id);

        if (updateError) throw new Error(updateError.message);
      });

      throw error;
    }

    await step.run("update-asset-status", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error: updateError } = await supabase
        .from("generated_assets")
        .update({ status: 'ready', media_url: mediaUrl })
        .eq("id", asset.id);

      if (updateError) throw new Error(updateError.message);
    });

    return { status: "success", assetId: asset.id };
  }
);
