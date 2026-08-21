import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import { ai } from "@/lib/gemini";
import { ContentProfile, Project } from "@/types/database";
import { Schema, Type } from "@google/genai";

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

export const generateIdeas = inngest.createFunction(
  {
    id: "generate-ideas",
    triggers: { event: "app/generate-ideas" },
  },
  async ({ event, step }) => {
    const { projectId } = event.data;

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
        
        Generate 5 specific content ideas that follow these EXACT patterns.
        
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

      return JSON.parse(text);
    });

    // 3. Save ideas to database
    await step.run("save-ideas", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const records = ideas.map((idea: any) => ({
        project_id: projectId,
        hook: idea.hook,
        caption: idea.caption,
        hashtags: idea.hashtags,
        format: idea.format,
        visual_prompt: idea.visual_prompt,
        status: 'proposed'
      }));

      const { error } = await supabase
        .from("content_ideas")
        .insert(records);

      if (error) throw new Error(error.message);
    });

    return { status: "success", count: ideas.length };
  }
);
