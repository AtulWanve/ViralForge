import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import { ai } from "@/lib/gemini";
import { Reference, Project } from "@/types/database";

export const analyzeProject = inngest.createFunction(
  {
    id: "analyze-project",
    triggers: { event: "viralforge/project.analyze" },
  },
  async ({ event, step }) => {
    const { projectId } = event.data;

    // 1. Fetch project and references
    const { project, references } = await step.run("fetch-data", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const [projectRes, referencesRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("references_table").select("*").eq("project_id", projectId)
      ]);

      if (projectRes.error) throw new Error(projectRes.error.message);
      if (referencesRes.error) throw new Error(referencesRes.error.message);

      return { project: projectRes.data as Project, references: referencesRes.data as Reference[] };
    });

    if (!references || references.length === 0) {
      return { status: "skipped", reason: "no references" };
    }

    // 2. Call Gemini for analysis
    const analysis = await step.run("analyze-with-gemini", async () => {
      const prompt = `
        Analyze these social media references for a project targeting ${project.target_platform}.
        Brand voice: ${project.brand_voice || 'Default'}
        Project description: ${project.description || 'N/A'}
        
        References:
        ${references.map(r => `
          URL: ${r.url || 'N/A'}
          Caption: ${r.caption || 'N/A'}
          Media URL: ${r.media_url || 'N/A'}
        `).join('\n')}
        
        Extract patterns and return a JSON object with:
        - visual_style (string): General visual aesthetic
        - hooks (array of strings): Common attention grabbers used
        - caption_structure (string): How they structure their text
        - format_mix (string): Types of media used
        - content_pillars (array of strings): Main topics covered
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from Gemini");
      
      return JSON.parse(text);
    });

    // 3. Save profile to database
    await step.run("save-profile", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Upsert to handle re-analysis
      const { error } = await supabase
        .from("content_profiles")
        .upsert({
          project_id: projectId,
          visual_style: analysis.visual_style,
          hooks: analysis.hooks,
          caption_structure: analysis.caption_structure,
          format_mix: analysis.format_mix,
          content_pillars: analysis.content_pillars,
          raw_analysis: analysis
        }, { onConflict: 'project_id' });

      if (error) throw new Error(error.message);
    });

    return { status: "success", projectId };
  }
);
