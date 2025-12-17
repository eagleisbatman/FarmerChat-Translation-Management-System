/**
 * LinguaFlow Server Components Utilities
 * 
 * These utilities are for use in Next.js Server Components
 */

import { LinguaFlowConfig, Translations } from "./types";

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Fetch translations on the server side
 * Use this in Next.js Server Components
 * 
 * @example
 * ```tsx
 * // app/page.tsx (Server Component)
 * import { getTranslations } from '@linguaflow/sdk-react/server';
 * 
 * export default async function Page() {
 *   const translations = await getTranslations({
 *     apiKey: process.env.LINGUAFLOW_API_KEY!,
 *     projectId: process.env.LINGUAFLOW_PROJECT_ID!,
 *   }, { language: 'en' });
 *   
 *   return <div>{translations.common.welcome}</div>;
 * }
 * ```
 */
export async function getTranslations(
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
    // Disable caching for server components to always get fresh data
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch translations: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get a single translation value from server-side translations
 * 
 * @example
 * ```tsx
 * const translations = await getTranslations(config);
 * const welcome = getTranslation(translations, "common.welcome");
 * ```
 */
export function getTranslation(
  translations: Translations,
  key: string,
  namespace?: string
): string | null {
  const parts = key.split(".");
  let current: any = translations;

  if (namespace && current[namespace]) {
    current = current[namespace];
  } else {
    // Try to find in any namespace
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

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }

  return typeof current === "string" ? current : null;
}

