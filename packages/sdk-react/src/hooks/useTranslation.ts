"use client";

import { useState, useEffect, useMemo } from "react";
import { useLinguaFlowConfig } from "../context";
import { getTranslations } from "../api";
import { UseTranslationResult, UseTranslationOptions } from "../types";

/**
 * Replace placeholders in translation string
 */
function replaceParams(
  text: string,
  params?: Record<string, string | number>
): string {
  if (!params) return text;
  
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key]?.toString() || match;
  });
}

/**
 * Get translation value from nested translations object
 */
function getTranslationValue(
  translations: Record<string, any>,
  key: string,
  namespace?: string
): string | null {
  const parts = key.split(".");
  let current: any = translations;

  // If namespace is specified, start from that namespace
  if (namespace && current[namespace]) {
    current = current[namespace];
  } else {
    // Try to find the key in any namespace
    for (const ns in current) {
      if (typeof current[ns] === "object" && current[ns] !== null) {
        let found = current[ns];
        for (const part of parts) {
          if (found && typeof found === "object" && part in found) {
            found = found[part];
          } else {
            found = null;
            break;
          }
        }
        if (found && typeof found === "string") {
          return found;
        }
      }
    }
    return null;
  }

  // Navigate through nested keys
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }

  return typeof current === "string" ? current : null;
}

/**
 * Hook to get a single translation
 * 
 * @example
 * ```tsx
 * const { t } = useTranslation();
 * <div>{t("welcome.message")}</div>
 * ```
 */
export function useTranslation(
  options: UseTranslationOptions = {}
): UseTranslationResult {
  const config = useLinguaFlowConfig();
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const language = options.language || config.defaultLanguage || "en";

  useEffect(() => {
    let cancelled = false;

    async function loadTranslations() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getTranslations(config, {
          language,
          namespace: options.namespace,
        });

        if (!cancelled) {
          setTranslations(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load translations"));
          setIsLoading(false);
        }
      }
    }

    loadTranslations();

    return () => {
      cancelled = true;
    };
  }, [config, language, options.namespace]);

  const t = useMemo(
    () => (key: string, params?: Record<string, string | number>): string => {
      const value = getTranslationValue(translations, key, options.namespace);
      
      if (value) {
        return replaceParams(value, params);
      }

      // Try fallback language
      if (options.fallbackLanguage && options.fallbackLanguage !== language) {
        // Note: This would require fetching fallback translations
        // For now, we'll just use the key or fallback to key
      }

      // Fallback to key if not found
      if (options.fallbackToKey !== false) {
        return key;
      }

      return "";
    },
    [translations, options.namespace, options.fallbackLanguage, language, options.fallbackToKey]
  );

  return {
    t,
    isLoading,
    error,
    language,
    translations,
  };
}

