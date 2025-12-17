/**
 * .NET RESX (Resource XML) format support
 * Supports parsing and exporting .resx files
 */

import { parseString } from "xml2js";
import { Builder } from "xml2js";

export interface RESXData {
  name: string;
  value: string;
  type?: string;
  mimetype?: string;
  space?: string;
  comment?: string;
}

/**
 * Parse a .resx file
 */
export function parseRESX(content: string): Promise<Array<{
  key: string;
  value: string;
  description?: string;
}>> {
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

      const root = result?.root;
      if (!root) {
        resolve(translations);
        return;
      }

      const data = root.data || [];

      for (const item of data) {
        const name = item.$.name;
        const value = item.value?.[0] || item.value || "";
        const comment = item.comment?.[0] || item.comment;

        if (name) {
          translations.push({
            key: name,
            value: typeof value === "string" ? value : "",
            description: comment,
          });
        }
      }

      resolve(translations);
    });
  });
}

/**
 * Export translations to .resx format
 */
export function exportToRESX(
  translations: Array<{
    key: string;
    source: string;
    target?: string;
    description?: string;
  }>
): string {
  const builder = new Builder({
    xmldec: { version: "1.0", encoding: "utf-8" },
    renderOpts: { pretty: true, indent: "  ", newline: "\n" },
  });

  const root = {
    root: {
      $: {
        xmlns: "http://www.w3.org/2001/XMLSchema",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
        "xmlns:resheader": "http://schemas.microsoft.com/resx/2001/1/default",
      },
      resheader: [
        {
          $: { name: "resmimetype" },
          value: ["text/microsoft-resx"],
        },
        {
          $: { name: "version" },
          value: ["2.0"],
        },
        {
          $: { name: "reader" },
          value: ["System.Resources.ResXResourceReader, System.Windows.Forms, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"],
        },
        {
          $: { name: "writer" },
          value: ["System.Resources.ResXResourceWriter, System.Windows.Forms, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"],
        },
      ],
      data: translations.map((t) => ({
        $: { name: t.key, "xml:space": "preserve" },
        value: [t.target || t.source],
        ...(t.description ? { comment: [t.description] } : {}),
      })),
    },
  };

  return builder.buildObject(root);
}

