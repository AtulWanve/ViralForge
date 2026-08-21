export interface MediaProvider {
  generateImage(prompt: string, id: string): Promise<string>;
  generateVideo(prompt: string, id: string): Promise<string>;
}