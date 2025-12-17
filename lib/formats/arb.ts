/**
 * Flutter ARB (Application Resource Bundle) format support
 * Supports parsing and exporting .arb files
 */

export interface ARBTranslation {
  key: string;
  value: string;
  description?: string;
  placeholders?: Record<string, {
    type: string;
    format?: string;
  }>;
  plural?: string; // Plural category
}

/**
 * Parse an .arb file (JSON format)
 */
export function parseARB(content: string): {
  translations: Array<{
    key: string;
    value: string;
    description?: string;
  }>;
  language?: string;
} {
  const data = JSON.parse(content);
  
  const translations: Array<{
    key: string;
    value: string;
    description?: string;
  }> = [];

  // Extract language from @@locale or metadata
  const language = data["@@locale"] || data["@metadata"]?.["locale"];

  for (const key in data) {
    // Skip metadata keys
    if (key.startsWith("@") || key.startsWith("@@")) {
      continue;
    }

    const value = data[key];
    if (typeof value !== "string") {
      continue;
    }

    // Get description from @key metadata
    const metadataKey = `@${key}`;
    const metadata = data[metadataKey];
    const description = metadata?.description || metadata?.meaning;

    translations.push({
      key,
      value,
      description,
    });
  }

  return { translations, language };
}

/**
 * Export translations to .arb format
 */
export function exportToARB(
  translations: Array<{
    key: string;
    source: string;
    target?: string;
    description?: string;
    namespace?: string;
  }>,
  language: string
): string {
  const arb: Record<string, any> = {
    "@@locale": language,
    "@@last_modified": new Date().toISOString(),
  };

  for (const t of translations) {
    arb[t.key] = t.target || t.source;

    if (t.description) {
      arb[`@${t.key}`] = {
        description: t.description,
      };
    }
  }

  return JSON.stringify(arb, null, 2);
}

