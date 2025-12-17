/**
 * YAML format support (Ruby on Rails style)
 * Supports parsing and exporting YAML translation files
 */

import * as yaml from "js-yaml";

export interface YAMLTranslations {
  [language: string]: {
    [namespace: string]: {
      [key: string]: string;
    };
  };
}

/**
 * Parse a YAML translation file (Rails i18n format)
 */
export function parseYAML(content: string): {
  translations: Array<{
    key: string;
    value: string;
    namespace?: string;
  }>;
  language?: string;
} {
  const data = yaml.load(content) as YAMLTranslations;
  
  const translations: Array<{
    key: string;
    value: string;
    namespace?: string;
  }> = [];

  // Rails YAML format: en: { namespace: { key: value } }
  for (const language in data) {
    const langData = data[language];
    
    if (typeof langData !== "object" || langData === null) {
      continue;
    }

    for (const namespace in langData) {
      const nsData = langData[namespace];
      
      if (typeof nsData !== "object" || nsData === null) {
        continue;
      }

      for (const key in nsData) {
        const value = nsData[key];
        if (typeof value === "string") {
          translations.push({
            key,
            value,
            namespace: namespace === language ? undefined : namespace,
          });
        }
      }
    }
  }

  // Extract first language found
  const language = Object.keys(data)[0]?.split("_")[0]?.split("-")[0];

  return { translations, language };
}

/**
 * Export translations to YAML format (Rails i18n format)
 */
export function exportToYAML(
  translations: Array<{
    key: string;
    source: string;
    target?: string;
    namespace?: string;
  }>,
  language: string
): string {
  const data: YAMLTranslations = {
    [language]: {},
  };

  // Group by namespace
  for (const t of translations) {
    const namespace = t.namespace || "default";
    if (!data[language][namespace]) {
      data[language][namespace] = {};
    }
    data[language][namespace][t.key] = t.target || t.source;
  }

  return yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    quotingType: '"',
  });
}

