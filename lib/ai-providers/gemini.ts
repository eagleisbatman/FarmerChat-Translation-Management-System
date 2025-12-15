import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProviderInterface, TranslationRequest, TranslationResponse } from "./types";

export class GeminiProvider implements AIProviderInterface {
  private client: GoogleGenerativeAI | null = null;

  constructor() {
    if (process.env.GEMINI_API_KEY) {
      this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  getName(): string {
    return "Google Gemini";
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.client) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `Translate the following text from ${request.sourceLanguage} to ${request.targetLanguage}. Only return the translated text, nothing else.\n\nText: ${request.text}`;

    try {
      const model = this.client.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const translatedText = response.text().trim();

      return {
        translatedText,
        provider: "gemini",
      };
    } catch (error) {
      console.error("Gemini translation error:", error);
      throw new Error(`Gemini translation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

