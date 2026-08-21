import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import { ai, ContentProfileSchema } from "@/lib/gemini";
import { Reference, Project } from "@/types/database";
import { contentProfileSchema } from "@/lib/validations/content-profile";

export const analyzeProject = inngest.createFunction(
  {
    id: "analyze-project",
    triggers: { event: "viralforge/project.analyze" },
    onFailure: async ({ event, error }) => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      // event.data.event contains the original event payload
      const projectId = event.data.event.data.projectId;
      const generationId = event.data.event.data.generationId;
      if (projectId) {
        if (generationId) {
          const { data: existing } = await supabase
            .from('content_profiles')
            .select('raw_analysis')
            .eq('project_id', projectId)
            .maybeSingle();

          if (existing?.raw_analysis?.generationId && existing.raw_analysis.generationId > generationId) {
            return;
          }
        }
        await supabase
          .from('projects')
          .update({ analysis_status: 'error' })
          .eq('id', projectId)
          .eq('current_generation', generationId);
      }
    }
  },
  async ({ event, step }) => {
    const { projectId, generationId } = event.data;

    const { project, references } = await step.run("fetch-project-data", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const [projectRes, referencesRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('references_table').select('*').eq('project_id', projectId)
      ]);

      if (projectRes.error) throw new Error(projectRes.error.message);
      if (referencesRes.error) throw new Error(referencesRes.error.message);

      return { project: projectRes.data as Project, references: referencesRes.data as Reference[] };
    });

    if (!references || references.length === 0) {
      return { status: "skipped", reason: "no references" };
    }

    const analysis = await step.run("analyze-with-gemini", async () => {
      // NOTE: This exact prompt is sent to Google's Gemini 2.5 Flash model
      // It dynamically generates the Content Profile structure based on the provided references.
      const prompt = `
        Analyze these social media references for a project targeting ${project.target_platform}.
        Brand voice: ${project.brand_voice || 'Default'}
        Project description: ${project.description || 'N/A'}

        References:
        ${references.map((r: Reference) => `
          URL: ${r.url || 'N/A'}
          Caption: ${r.caption || 'N/A'}
          Media URL: ${r.media_url || 'N/A'}
        `).join('\n')}

        Extract patterns and return a JSON object with:
        - schemaVersion (integer): Always 1
        - visual_style (string): General visual aesthetic
        - hooks (array of strings): Common attention grabbers used
        - caption_structure (string): How they structure their text
        - format_mix (string): Types of media used
        - content_pillars (array of strings): Main topics covered
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: ContentProfileSchema
        }
      });

      if (!response.text) throw new Error('No response from Gemini');

      let parsed;
      try {
        parsed = JSON.parse(response.text);
      } catch (err) {
        throw new Error('Failed to parse Gemini response: ' + (err as Error).message);
      }

      const validationResult = contentProfileSchema.safeParse(parsed);

      if (!validationResult.success) {
        throw new Error('Validation failed for Gemini response: ' + validationResult.error.message);
      }

      return validationResult.data;
    });

    const saveAnalysis = await step.run("save-analysis", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const rawAnalysisToSave = {
        ...analysis,
        generationId
      };

      // Atomically save only when the stored generationId is absent or lower,
      // so a stale analysis can never overwrite a newer one.
      const { data: saved, error } = await supabase.rpc("save_profile_if_newer", {
        p_project_id: projectId,
        p_visual_style: analysis.visual_style,
        p_hooks: analysis.hooks,
        p_caption_structure: analysis.caption_structure,
        p_format_mix: analysis.format_mix,
        p_content_pillars: analysis.content_pillars,
        p_raw_analysis: rawAnalysisToSave
      });

      if (error) throw new Error(error.message);

      // A project_not_found (ok: false) is a real error, not a skip.
      if (!saved?.ok) throw new Error(saved?.error || 'Failed to save content profile');

      return saved;
    });

    // Only a strictly newer stored generation means this analysis is stale and
    // must be skipped. An equal generation (same_generation) already saved the
    // profile; fall through so the retry can still complete the status
    // transition below.
    if (saveAnalysis?.reason === 'stale') {
      return { skipped: true, reason: 'newer generation exists' };
    }

    // Split into its own retryable step so a failure here can be retried
    // without re-entering the (already idempotent) profile write.
    await step.run("mark-analysis-completed", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error: projectError } = await supabase
        .from('projects')
        .update({ analysis_status: 'completed' })
        .eq('id', projectId)
        .eq('current_generation', generationId);

      if (projectError) throw new Error(projectError.message);
    });

    return { success: true };
  }
);
