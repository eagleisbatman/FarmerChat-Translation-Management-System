export type AIProvider = "openai" | "gemini" | "google-translate";

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  imageUrl?: string; // Optional image URL for context-aware translation
  imageBase64?: string; // Optional base64 image for providers that support it
  context?: string; // Additional context about the translation
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

