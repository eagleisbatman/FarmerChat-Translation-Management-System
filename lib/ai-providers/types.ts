export type AIProvider = "openai" | "gemini" | "google-translate";

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResponse {
  translatedText: string;
  provider: AIProvider;
  cost?: number;
}

export interface AIProviderInterface {
  translate(request: TranslationRequest): Promise<TranslationResponse>;
  getName(): string;
  isAvailable(): boolean;
}

