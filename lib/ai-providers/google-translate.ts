import { v2 } from "@google-cloud/translate";
import type { AIProviderInterface, TranslationRequest, TranslationResponse } from "./types";

export class GoogleTranslateProvider implements AIProviderInterface {
  private client: v2.Translate | null = null;

  constructor() {
    if (process.env.GOOGLE_TRANSLATE_API_KEY) {
      this.client = new v2.Translate({
        key: process.env.GOOGLE_TRANSLATE_API_KEY,
      });
    }
  }

  getName(): string {
    return "Google Translate";
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.client) {
      throw new Error("Google Translate API key not configured");
    }

    try {
      const [translation] = await this.client.translate(request.text, {
        from: request.sourceLanguage,
        to: request.targetLanguage,
      });

      return {
        translatedText: translation,
        provider: "google-translate",
      };
    } catch (error) {
      console.error("Google Translate error:", error);
      throw new Error(`Google Translate failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

