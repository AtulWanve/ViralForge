import { GoogleGenAI, Type, Schema } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable");
}

// Initialize the Google Generative AI SDK
// The API key is taken from the environment variable GEMINI_API_KEY
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const ContentProfileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    visual_style: { type: Type.STRING },
    hooks: { type: Type.ARRAY, items: { type: Type.STRING } },
    caption_structure: { type: Type.STRING },
    format_mix: { type: Type.STRING },
    content_pillars: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["visual_style", "hooks", "caption_structure", "format_mix", "content_pillars"]
};
