import type { AIProvider } from "./ai-providers/types";
import { OpenAIProvider } from "./ai-providers/openai";
import { GeminiProvider } from "./ai-providers/gemini";
import { GoogleTranslateProvider } from "./ai-providers/google-translate";
import type { TranslationRequest, TranslationResponse } from "./ai-providers/types";

export class AutoTranslateService {
  private providers: Map<AIProvider, { instance: OpenAIProvider | GeminiProvider | GoogleTranslateProvider; available: boolean }> = new Map();

  constructor() {
    const openai = new OpenAIProvider();
    const gemini = new GeminiProvider();
    const googleTranslate = new GoogleTranslateProvider();

    this.providers.set("openai", { instance: openai, available: openai.isAvailable() });
    this.providers.set("gemini", { instance: gemini, available: gemini.isAvailable() });
    this.providers.set("google-translate", { instance: googleTranslate, available: googleTranslate.isAvailable() });
  }

  async translate(
    request: TranslationRequest,
    preferredProvider?: AIProvider,
    fallbackProvider?: AIProvider
  ): Promise<TranslationResponse> {
    const providersToTry: AIProvider[] = [];

    if (preferredProvider) {
      providersToTry.push(preferredProvider);
    }
    if (fallbackProvider && fallbackProvider !== preferredProvider) {
      providersToTry.push(fallbackProvider);
    }

    // Add all available providers as fallback
    for (const [provider, { available }] of this.providers) {
      if (available && !providersToTry.includes(provider)) {
        providersToTry.push(provider);
      }
    }

    let lastError: Error | null = null;

    for (const provider of providersToTry) {
      const providerData = this.providers.get(provider);
      if (!providerData || !providerData.available) {
        continue;
      }

      try {
        return await providerData.instance.translate(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Provider ${provider} failed, trying next...`, error);
        continue;
      }
    }

    throw new Error(`All translation providers failed. Last error: ${lastError?.message || "Unknown error"}`);
  }

  getAvailableProviders(): AIProvider[] {
    const available: AIProvider[] = [];
    for (const [provider, { available: isAvailable }] of this.providers) {
      if (isAvailable) {
        available.push(provider);
      }
    }
    return available;
  }
}

