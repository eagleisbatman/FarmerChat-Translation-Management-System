import OpenAI from "openai";
import type { AIProviderInterface, TranslationRequest, TranslationResponse } from "./types";

export class OpenAIProvider implements AIProviderInterface {
  private client: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  getName(): string {
    return "OpenAI";
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.client) {
      throw new Error("OpenAI API key not configured");
    }

    const prompt = `Translate the following text from ${request.sourceLanguage} to ${request.targetLanguage}. Only return the translated text, nothing else.\n\nText: ${request.text}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional translator. Translate accurately and preserve the meaning and tone.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const translatedText = completion.choices[0]?.message?.content?.trim() || "";

      // Estimate cost (rough calculation)
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const cost = (inputTokens / 1000000) * 0.15 + (outputTokens / 1000000) * 0.6;

      return {
        translatedText,
        provider: "openai",
        cost,
      };
    } catch (error) {
      console.error("OpenAI translation error:", error);
      throw new Error(`OpenAI translation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

