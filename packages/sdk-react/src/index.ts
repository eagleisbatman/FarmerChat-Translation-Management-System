/**
 * LinguaFlow React SDK
 * 
 * @packageDocumentation
 */

// Context and Provider
export { LinguaFlowProvider, useLinguaFlowConfig } from "./context";
export type { LinguaFlowProviderProps } from "./context";

// Hooks
export { useTranslation } from "./hooks/useTranslation";
export { useTranslations } from "./hooks/useTranslations";

// Components
export { Translation } from "./components/Translation";
export type { TranslationProps } from "./components/Translation";

// Types
export type {
  LinguaFlowConfig,
  Translation,
  Translations,
  UseTranslationOptions,
  UseTranslationResult,
  UseTranslationsResult,
} from "./types";

// API utilities (for advanced usage)
export { fetchTranslations, getTranslations, clearTranslationCache } from "./api";

