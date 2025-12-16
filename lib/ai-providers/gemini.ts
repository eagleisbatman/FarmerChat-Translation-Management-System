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
      // Use latest Gemini models (2025)
      // For images: gemini-1.5-pro or gemini-2.0-flash-exp (if available)
      // For text-only: gemini-1.5-pro or gemini-2.0-flash-exp
      const modelName = (request.imageUrl || request.imageBase64) 
        ? "gemini-1.5-pro" // Vision-capable model
        : "gemini-1.5-flash"; // Faster, cost-effective for text-only
      const model = this.client.getGenerativeModel({ model: modelName });

      let result;
      if (request.imageBase64) {
        // Gemini supports base64 images
        const imagePart = {
          inlineData: {
            data: request.imageBase64,
            mimeType: "image/jpeg",
          },
        };
        result = await model.generateContent([prompt, imagePart]);
      } else if (request.imageUrl) {
        // Fetch image and convert to base64, or use URL if supported
        // For now, we'll fetch and convert
        try {
          const imageResponse = await fetch(request.imageUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageBase64 = Buffer.from(imageBuffer).toString("base64");
          const imagePart = {
            inlineData: {
              data: imageBase64,
              mimeType: imageResponse.headers.get("content-type") || "image/jpeg",
            },
          };
          result = await model.generateContent([prompt, imagePart]);
        } catch (imageError) {
          // Fallback to text-only if image fetch fails
          result = await model.generateContent(prompt);
        }
      } else {
        result = await model.generateContent(prompt);
      }
      
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

