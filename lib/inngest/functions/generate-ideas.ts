import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import { ai } from "@/lib/gemini";
import { ASSET_TYPES, ContentProfile, Project } from "@/types/database";
import { Schema, Type } from "@google/genai";
import { z } from "zod";

const IdeaSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      hook: { type: Type.STRING },
      caption: { type: Type.STRING },
      hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
      format: { type: Type.STRING },
      visual_prompt: { type: Type.STRING }
    },
    required: ["hook", "caption", "hashtags", "format", "visual_prompt"]
  }
};

const generatedIdeaSchema = z.object({
  hook: z.string().trim().min(1),
  caption: z.string().trim().min(1),
  hashtags: z.array(z.string().trim().min(1)).min(1),
  format: z.string().trim().min(1),
  visual_prompt: z.string().trim().min(1),
});

export const generateIdeas = inngest.createFunction(
  {
    id: "generate-ideas",
    triggers: { event: "app/generate-ideas" },
  },
  async ({ event, step }) => {
    const { projectId, count = 5, requestId } = event.data;
    let claimToken: string | null = null;

    if (!Number.isInteger(count) || count < 1 || count > 20) {
      throw new Error("Invalid request count: expected a positive integer between 1 and 20");
    }

    // If this is a regeneration request, check for deduplication
    if (requestId) {
      const alreadyProcessed = await step.run("check-deduplication", async () => {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Atomically claim the request, or recover a stale one left in
        // 'processing' by a crashed worker so it can be retried. A single
        // winner is guaranteed, so retries never spawn duplicate generations.
        // The returned value is the claim token that must accompany the later
        // complete/fail call, or null when another worker owns the request.
        const { data: claimed, error: claimError } = await supabase.rpc(
          "claim_regeneration_request",
          { req_id: requestId }
        );

        if (claimError) throw new Error(claimError.message);

        if (!claimed) {
          return { alreadyProcessed: true, claimToken: null };
        }
        return { alreadyProcessed: false, claimToken: claimed };
      });

      if (alreadyProcessed.alreadyProcessed) {
        return { status: "skipped", reason: "Already processed", requestId };
      }
      claimToken = alreadyProcessed.claimToken;
    }

    try {
    // 1. Fetch project and profile
    const { project, profile } = await step.run("fetch-profile", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const [projectRes, profileRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("content_profiles").select("*").eq("project_id", projectId).single()
      ]);

      if (projectRes.error) throw new Error(projectRes.error.message);
      if (profileRes.error) throw new Error(profileRes.error.message);

      return { project: projectRes.data as Project, profile: profileRes.data as ContentProfile };
    });

    // 2. Call Gemini to generate ideas
    const ideas = await step.run("generate-with-gemini", async () => {
      const prompt = `
        Based on this content profile for a ${project.target_platform} project:
        Visual Style: ${profile.visual_style}
        Hooks: ${profile.hooks.join(', ')}
        Caption Structure: ${profile.caption_structure}
        Format Mix: ${profile.format_mix}
        Pillars: ${profile.content_pillars.join(', ')}
        
        Generate ${count} specific content idea${count === 1 ? '' : 's'} that follow${count === 1 ? 's' : ''} these EXACT patterns.
        
        Return a JSON array of objects with:
        - hook (string): The opening text/hook
        - caption (string): The full caption
        - hashtags (array of strings): 3-5 relevant hashtags
        - format (string): "image" or "video" or "carousel"
        - visual_prompt (string): A detailed prompt for an image generator (like FLUX/Midjourney) to create the visual asset. Make it highly descriptive.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: IdeaSchema
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from Gemini");

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length !== count) {
        throw new Error(`Expected ${count} ideas but got ${Array.isArray(parsed) ? parsed.length : 0}`);
      }

      // Validate every idea field (including hashtags) against the runtime
      // schema so malformed records never reach complete_generation_ideas.
      const validation = z.array(generatedIdeaSchema).safeParse(parsed);
      if (!validation.success) {
        throw new Error('Validation failed for Gemini ideas: ' + validation.error.message);
      }

      return validation.data;
    });

    // 3. Save ideas to database
    const superseded = await step.run("save-ideas", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get user_id from project
      const { data: projectData } = await supabase
        .from("projects")
        .select("user_id")
        .eq("id", projectId)
        .single();

      if (!projectData) throw new Error("Project not found");

      // Gemini returns format as free text (the schema only types it STRING),
      // but the DB column is the asset_type enum. Coerce to a valid label so
      // one malformed idea cannot abort the whole batch inside the RPC.
      const records = ideas.map((idea: any) => {
        const normalizedFormat = String(idea?.format ?? "").trim().toLowerCase();
        const format = (ASSET_TYPES as readonly string[]).includes(normalizedFormat)
          ? (normalizedFormat as (typeof ASSET_TYPES)[number])
          : "image";

        return {
          project_id: projectId,
          user_id: projectData.user_id,
          hook: idea.hook,
          caption: idea.caption,
          hashtags: idea.hashtags,
          format,
          visual_prompt: idea.visual_prompt,
          status: 'proposed'
        };
      });

      // For regenerations, insert ideas and mark the request completed in a
      // single transaction so a failure rolls back both. If the request is no
      // longer claimed (a concurrent worker finished it), the RPC no-ops and the
      // ideas we generated are dropped, avoiding duplicates.
      if (requestId) {
        const { data: completed, error } = await supabase.rpc(
          "complete_generation_ideas",
          {
            p_request_id: requestId,
            p_project_id: projectId,
            p_user_id: projectData.user_id,
            p_ideas: records,
            p_claim_token: claimToken
          }
        );

        if (error) throw new Error(error.message);

        return completed === false;
      } else {
        const { error } = await supabase
          .from("content_ideas")
          .insert(records);

        if (error) throw new Error(error.message);

        return false;
      }
    });

    if (superseded) {
      return { status: "skipped", reason: "Already completed by another worker", requestId };
    }

    return { status: "success", count: ideas.length, requestId };
    } catch (error) {
      if (requestId) {
        await step.run("mark-failed", async () => {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

// Propagate a failure to record the failed state, otherwise the request
        // would be left stuck in 'processing' and never retried. Scoped to the
        // caller's claim token so a stale worker can never fail a later lease.
        const { error: failError } = await supabase
          .from("regeneration_requests")
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : String(error),
            completed_at: new Date().toISOString(),
          })
          .eq("id", requestId)
          .eq("status", "processing")
          .eq("claim_token", claimToken);

          if (failError) {
            const original = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to mark regeneration request ${requestId} as failed: ${failError.message}; original error: ${original}`);
          }
        });
      }
      throw error;
    }
  }
);
