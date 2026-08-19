import { GoogleGenAI } from '@google/genai';

// Initialize the Google Generative AI SDK
// The API key is taken from the environment variable GEMINI_API_KEY
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
