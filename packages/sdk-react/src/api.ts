import { LinguaFlowConfig, Translations } from "./types";

const DEFAULT_BASE_URL = typeof window !== "undefined" 
  ? window.location.origin 
  : "http://localhost:3000";

/**
 * Fetch translations from LinguaFlow API
 */
export async function fetchTranslations(
  config: LinguaFlowConfig,
  options: {
    language?: string;
    namespace?: string;
  } = {}
): Promise<Translations> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const params = new URLSearchParams();
  
  if (options.language) {
    params.append("lang", options.language);
  }
  
  if (options.namespace) {
    params.append("namespace", options.namespace);
  }

  const url = `${baseUrl}/api/v1/translations?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      "X-API-Key": config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch translations: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Cache for translations
 */
const translationCache = new Map<string, { data: Translations; timestamp: number }>();

/**
 * Get cached translations or fetch if not cached or expired
 */
export async function getTranslations(
  config: LinguaFlowConfig,
  options: {
    language?: string;
    namespace?: string;
  } = {}
): Promise<Translations> {
  const cacheKey = `${config.projectId}-${options.language || "all"}-${options.namespace || "all"}`;
  const cached = translationCache.get(cacheKey);
  const ttl = config.cacheTTL || 5 * 60 * 1000; // Default 5 minutes

  if (
    config.cacheEnabled !== false &&
    cached &&
    Date.now() - cached.timestamp < ttl
  ) {
    return cached.data;
  }

  const translations = await fetchTranslations(config, options);
  
  if (config.cacheEnabled !== false) {
    translationCache.set(cacheKey, {
      data: translations,
      timestamp: Date.now(),
    });
  }

  return translations;
}

/**
 * Clear translation cache
 */
export function clearTranslationCache(projectId?: string): void {
  if (projectId) {
    // Clear cache for specific project
    for (const key of translationCache.keys()) {
      if (key.startsWith(`${projectId}-`)) {
        translationCache.delete(key);
      }
    }
  } else {
    // Clear all cache
    translationCache.clear();
  }
}

