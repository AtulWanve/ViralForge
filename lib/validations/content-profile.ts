import { z } from "zod";

export const contentProfileSchema = z.object({
  visual_style: z.string(),
  hooks: z.array(z.string()),
  caption_structure: z.string(),
  format_mix: z.string(),
  content_pillars: z.array(z.string()),
});
