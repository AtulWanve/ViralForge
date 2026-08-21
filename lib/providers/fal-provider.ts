import { fal } from "@fal-ai/client";
import { MediaProvider } from "./media-provider";
import { MockProvider } from "./mock-provider";

function requireHttpsUrl(value: unknown, message: string): string {
  if (typeof value !== "string") throw new Error(message);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(message);
  }
  if (parsed.protocol !== "https:") throw new Error(message);
  return value;
}

export class FalProvider implements MediaProvider {
  async generateImage(prompt: string, _id: string): Promise<string> {
    try {
      const result = await fal.subscribe("fal-ai/fast-sdxl", {
        input: {
          prompt: prompt,
          image_size: "square_hd",
        },
        logs: true,
      });

      return requireHttpsUrl(
        result.data?.images?.[0]?.url,
        "Fal image generation returned no image URL"
      );
    } catch (error) {
      console.error("Fal image generation error:", error);
      throw error;
    }
  }

  async generateVideo(prompt: string, _id: string): Promise<string> {
    try {
      const result = await fal.subscribe("fal-ai/minimax/video-01", {
        input: { prompt },
        logs: true,
      });
      return requireHttpsUrl(
        result.data?.video?.url,
        "Fal video generation returned no video URL"
      );
    } catch (error) {
      console.error("Fal video generation error:", error);
      const errorMessage = String(error).toLowerCase();
      // 403 Forbidden / 401 Unauthorized usually means out of credits or invalid key
      if (errorMessage.includes("403") || errorMessage.includes("unauthorized") || errorMessage.includes("forbidden") || errorMessage.includes("401")) {
        console.warn("Fal API rejected video generation (likely out of credits). Falling back to MockProvider for video.");
        const mock = new MockProvider();
        return mock.generateVideo(prompt, _id);
      }
      throw error;
    }
  }
}

export function createMediaProvider(): MediaProvider {
  if (process.env.FAL_KEY && process.env.FAL_KEY !== "mock-key") {
    return new FalProvider();
  }
  return new MockProvider();
}
