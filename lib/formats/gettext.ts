/**
 * Gettext (.po/.pot) format support
 * Supports parsing and exporting .po and .pot files
 */

import * as gettextParser from "gettext-parser";

export interface GettextTranslation {
  key: string;
  msgid: string;
  msgstr: string;
  msgctxt?: string; // Context
  comments?: {
    translator?: string[];
    extracted?: string[];
    reference?: string[];
    flag?: string[];
    previous?: string[];
  };
  plural?: {
    msgid_plural: string;
    msgstr: string[];
  };
}

export interface GettextDocument {
  charset: string;
  headers: Record<string, string>;
  translations: Record<string, Record<string, GettextTranslation>>;
}

/**
 * Parse a .po or .pot file
 */
export function parseGettext(content: string): {
  translations: Array<{
    key: string;
    value: string;
    namespace?: string;
    description?: string;
    context?: string;
  }>;
  language?: string;
} {
  const parsed = gettextParser.po.parse(content, "utf-8");
  
  const translations: Array<{
    key: string;
    value: string;
    namespace?: string;
    description?: string;
    context?: string;
  }> = [];

  // Extract language from headers
  const language = parsed.headers?.["Language"]?.split("_")[0] || 
                   parsed.headers?.["Language"]?.split("-")[0];

  // Iterate through all contexts
  for (const context in parsed.translations) {
    const contextTranslations = parsed.translations[context];
    
    for (const msgid in contextTranslations) {
      const translation = contextTranslations[msgid];
      
      // Skip empty msgid (header)
      if (!msgid) continue;

      // Use msgstr[0] for singular, or first non-empty plural
      let value = translation.msgstr?.[0] || "";
      if (!value && translation.plural?.msgstr) {
        value = translation.plural.msgstr.find((v) => v) || "";
      }

      // Build key with context if present
      const key = translation.msgctxt ? `${translation.msgctxt}::${msgid}` : msgid;

      // Extract description from comments
      const description = [
        ...(translation.comments?.extracted || []),
        ...(translation.comments?.translator || []),
      ].join("\n");

      translations.push({
        key,
        value,
        context: translation.msgctxt,
        description: description || undefined,
      });
    }
  }

  return { translations, language };
}

/**
 * Export translations to .po format
 */
export function exportToGettext(
  translations: Array<{
    key: string;
    source: string;
    target?: string;
    description?: string;
    namespace?: string;
  }>,
  sourceLanguage: string,
  targetLanguage: string,
  headers?: Record<string, string>
): string {
  const poData: GettextDocument = {
    charset: "utf-8",
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "Content-Transfer-Encoding": "8bit",
      "Language": targetLanguage,
      "Plural-Forms": `nplurals=2; plural=(n != 1);`,
      ...headers,
    },
    translations: {},
  };

  // Group translations by context/namespace
  const contextMap = new Map<string, GettextTranslation[]>();

  for (const t of translations) {
    const context = t.namespace || "";
    if (!contextMap.has(context)) {
      contextMap.set(context, []);
    }

    // Split key if it contains context separator
    const [msgctxt, msgid] = t.key.includes("::") 
      ? t.key.split("::", 2)
      : [undefined, t.key];

    const translation: GettextTranslation = {
      key: msgid,
      msgid: t.source,
      msgstr: t.target || "",
      msgctxt: msgctxt || t.namespace,
      comments: t.description
        ? {
            extracted: [t.description],
          }
        : undefined,
    };

    contextMap.get(context)!.push(translation);
  }

  // Convert to gettext format
  for (const [context, transList] of contextMap) {
    if (!poData.translations[context]) {
      poData.translations[context] = {};
    }

    for (const trans of transList) {
      poData.translations[context][trans.msgid] = {
        key: trans.key,
        msgid: trans.msgid,
        msgstr: trans.msgstr,
        msgctxt: trans.msgctxt,
        comments: trans.comments,
      };
    }
  }

  return gettextParser.po.compile(poData, { eol: "\n" });
}

