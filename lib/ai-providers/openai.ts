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

    // Build prompt with context
    let prompt = `Translate the following text from ${request.sourceLanguage} to ${request.targetLanguage}.`;
    
    if (request.context) {
      prompt += `\n\nContext: ${request.context}`;
    }
    
    if (request.imageUrl || request.imageBase64) {
      prompt += `\n\nThis text appears in a user interface. Use the provided image as context to understand the UI context and translate appropriately.`;
    }
    
    prompt += `\n\nOnly return the translated text, nothing else.\n\nText: ${request.text}`;

    try {
      const messages: Array<{
        role: "system" | "user";
        content: string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
      }> = [
        {
          role: "system",
          content: "You are a professional translator specializing in UI/UX translations. Translate accurately, preserve meaning and tone, and consider the UI context when provided.",
        },
      ];

      // Add image if provided (OpenAI supports image URLs and base64)
      if (request.imageUrl || request.imageBase64) {
        const imageUrl = request.imageBase64 
          ? `data:image/jpeg;base64,${request.imageBase64}`
          : request.imageUrl!;
        
        messages.push({
          role: "user",
          content: [
            {
              type: "image_url" as const,
              image_url: { url: imageUrl },
            },
            {
              type: "text" as const,
              text: prompt,
            },
          ],
        });
      } else {
        messages.push({
          role: "user",
          content: prompt,
        });
      }

      const completion = await this.client.chat.completions.create({
        model: request.imageUrl || request.imageBase64 ? "gpt-4o" : "gpt-4o-mini", // Use vision model if image provided
        messages: messages as any,
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

