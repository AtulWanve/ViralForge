import { GoogleGenAI, Type, Schema } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable");
}

// Initialize the Google Generative AI SDK
// The API key is taken from the environment variable GEMINI_API_KEY
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const CarouselSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      slide_number: { type: Type.INTEGER },
      visual_prompt: { type: Type.STRING },
      copy: { type: Type.STRING },
    },
    required: ["slide_number", "visual_prompt", "copy"],
  },
};

export async function splitCarouselPrompts(
  originalPrompt: string,
  slides: number
): Promise<{ visual_prompt: string; copy: string }[]> {
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are turning a single visual prompt into ${slides} distinct slide concepts for a carousel post. Keep them visually coherent (same subject, palette, and composition language) so the deck reads as one piece.

Original prompt: "${originalPrompt}"

Return a JSON array of ${slides} objects, one per slide, in presented order, each with:
- slide_number (integer): 1-based index
- visual_prompt (string): a detailed, self-contained image prompt for that slide
- copy (string): short on-image text (2-6 words) for that slide, or "" if it should carry no text`,
    config: {
      responseMimeType: "application/json",
      responseSchema: CarouselSchema,
    },
  });

  const text = result.text;
  if (!text) throw new Error("No response from Gemini for carousel split");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Gemini returned malformed JSON for carousel split: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!Array.isArray(parsed) || parsed.length !== slides) {
    throw new Error(`Expected ${slides} carousel slides but got ${Array.isArray(parsed) ? parsed.length : 0}`);
  }
  const invalidIndex = parsed.findIndex(
    (s: any) =>
      typeof s !== "object" ||
      s === null ||
      typeof s.visual_prompt !== "string" ||
      s.visual_prompt.length === 0 ||
      typeof s.copy !== "string"
  );
  if (invalidIndex >= 0) {
    throw new Error(`Carousel response contained an invalid slide: ${JSON.stringify(parsed[invalidIndex])}`);
  }
  const numbers = parsed.map((s: any) => s.slide_number as number);
  const expected = Array.from({ length: slides }, (_, i) => i + 1);
  const isSequential = numbers.every((n, i) => n === expected[i]);
  if (!isSequential) {
    throw new Error(`Carousel slide numbers must be unique and sequential 1..${slides}; got ${JSON.stringify(numbers)}`);
  }
  return parsed.map((s: any) => ({
    visual_prompt: s.visual_prompt,
    copy: s.copy,
  }));
}

export const ContentProfileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    schemaVersion: { type: Type.INTEGER },
    visual_style: { type: Type.STRING },
    hooks: { type: Type.ARRAY, items: { type: Type.STRING } },
    caption_structure: { type: Type.STRING },
    format_mix: { type: Type.STRING },
    content_pillars: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["schemaVersion", "visual_style", "hooks", "caption_structure", "format_mix", "content_pillars"]
};
