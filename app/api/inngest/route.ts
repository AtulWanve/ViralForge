import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { analyzeProject } from "@/lib/inngest/functions/analyze-project";
import { generateIdeas } from "@/lib/inngest/functions/generate-ideas";
import { generateMedia } from "@/lib/inngest/functions/generate-media";
import { publishScheduledPosts } from "@/lib/inngest/functions/publish-scheduled";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    analyzeProject,
    generateIdeas,
    generateMedia,
    publishScheduledPosts
  ],
});
