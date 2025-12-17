/**
 * LinguaFlow React SDK Types
 */

export interface LinguaFlowConfig {
  apiKey: string;
  projectId: string;
  baseUrl?: string;
  defaultLanguage?: string;
  cacheEnabled?: boolean;
  cacheTTL?: number; // in milliseconds
}

export interface Translation {
  key: string;
  value: string;
  namespace?: string;
  language: string;
}

export interface Translations {
  [namespace: string]: {
    [key: string]: string;
  };
}

export interface UseTranslationOptions {
  language?: string;
  namespace?: string;
  fallbackLanguage?: string;
  fallbackToKey?: boolean;
}

export interface UseTranslationResult {
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
  error: Error | null;
  language: string;
  translations: Translations;
}

export interface UseTranslationsResult {
  translations: Translations;
  isLoading: boolean;
  error: Error | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

