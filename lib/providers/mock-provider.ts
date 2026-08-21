import { MediaProvider } from "./media-provider";

const MOCK_IMAGE = "https://picsum.photos/1024/1024";
const MOCK_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

/**
 * Deterministic provider used in tests and local demos without a real FAL_KEY.
 * Never used at runtime by the pipeline unless explicitly wired in.
 */
export class MockProvider implements MediaProvider {
  async generateImage(_prompt: string, _id: string): Promise<string> {
    return MOCK_IMAGE;
  }
  async generateVideo(_prompt: string, _id: string): Promise<string> {
    return MOCK_VIDEO;
  }
}