/**
 * Android XML strings format support
 * Supports parsing and exporting strings.xml files
 */

import { parseString } from "xml2js";
import { Builder } from "xml2js";

export interface AndroidString {
  name: string;
  value: string;
  translatable?: boolean;
  formatted?: boolean;
}

/**
 * Parse an Android strings.xml file
 */
export function parseAndroidXML(content: string): Array<{
  key: string;
  value: string;
  description?: string;
}> {
  return new Promise((resolve, reject) => {
    parseString(content, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      const translations: Array<{
        key: string;
        value: string;
        description?: string;
      }> = [];

      const resources = result?.resources;
      if (!resources) {
        resolve(translations);
        return;
      }

      const strings = resources.string || [];
      const stringArrays = resources["string-array"] || [];

      // Parse regular strings
      for (const str of strings) {
        const name = str.$.name;
        const value = Array.isArray(str._) ? str._.join("") : str._ || "";
        const translatable = str.$.translatable !== "false";

        if (name && translatable) {
          translations.push({
            key: name,
            value: value.trim(),
          });
        }
      }

      // Parse string arrays
      for (const arr of stringArrays) {
        const name = arr.$.name;
        const items = arr.item || [];

        for (let i = 0; i < items.length; i++) {
          const itemValue = Array.isArray(items[i]._) ? items[i]._.join("") : items[i]._ || "";
          translations.push({
            key: `${name}[${i}]`,
            value: itemValue.trim(),
          });
        }
      }

      resolve(translations);
    });
  });
}

/**
 * Export translations to Android strings.xml format
 */
export function exportToAndroidXML(
  translations: Array<{
    key: string;
    source: string;
    target?: string;
    description?: string;
  }>
): string {
  const builder = new Builder({
    xmldec: { version: "1.0", encoding: "UTF-8" },
    renderOpts: { pretty: true, indent: "    ", newline: "\n" },
  });

  const resources = {
    resources: {
      string: translations.map((t) => ({
        _: t.target || t.source,
        $: {
          name: t.key,
        },
      })),
    },
  };

  return builder.buildObject(resources);
}

