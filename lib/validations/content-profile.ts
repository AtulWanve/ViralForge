import { z } from "zod";

export const contentProfileSchema = z.object({
  schemaVersion: z.literal(1),
  visual_style: z.string().trim().min(1),
  hooks: z.array(z.string().trim().min(1)).min(1).max(20),
  caption_structure: z.string().trim().min(1),
  format_mix: z.string().trim().min(1),
  content_pillars: z.array(z.string().trim().min(1)).min(1).max(20),
});
