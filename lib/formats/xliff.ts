/**
 * XLIFF (XML Localization Interchange File Format) support
 * Supports XLIFF 1.2 and 2.0 formats
 */

export interface XLIFFTranslationUnit {
  id: string;
  source: string;
  target?: string;
  note?: string;
  context?: {
    type?: string;
    value?: string;
  };
}

export interface XLIFFDocument {
  version: "1.2" | "2.0";
  sourceLanguage: string;
  targetLanguage: string;
  datatype?: string;
  original?: string;
  units: XLIFFTranslationUnit[];
}

/**
 * Export translations to XLIFF 1.2 format
 */
export function exportToXLIFF12(
  translations: Array<{
    key: string;
    source: string;
    target?: string;
    note?: string;
    namespace?: string;
  }>,
  sourceLanguage: string,
  targetLanguage: string
): string {
  const units = translations
    .map((t) => {
      const escapedSource = escapeXml(t.source);
      const escapedTarget = t.target ? escapeXml(t.target) : "";
      const escapedNote = t.note ? escapeXml(t.note) : "";
      
      return `    <trans-unit id="${escapeXml(t.key)}">
      <source>${escapedSource}</source>
      ${escapedTarget ? `<target>${escapedTarget}</target>` : ""}
      ${escapedNote ? `<note>${escapedNote}</note>` : ""}
      ${t.namespace ? `<context-group><context context-type="x-namespace">${escapeXml(t.namespace)}</context></context-group>` : ""}
    </trans-unit>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="" source-language="${sourceLanguage}" target-language="${targetLanguage}" datatype="plaintext">
    <header>
      <tool tool-id="linguaflow" tool-name="LinguaFlow - Seamless Translation Management"/>
    </header>
    <body>
${units}
    </body>
  </file>
</xliff>`;
}

/**
 * Export translations to XLIFF 2.0 format
 */
export function exportToXLIFF20(
  translations: Array<{
    key: string;
    source: string;
    target?: string;
    note?: string;
    namespace?: string;
  }>,
  sourceLanguage: string,
  targetLanguage: string
): string {
  const units = translations
    .map((t) => {
      const escapedSource = escapeXml(t.source);
      const escapedTarget = t.target ? escapeXml(t.target) : "";
      const escapedNote = t.note ? escapeXml(t.note) : "";
      
      return `    <unit id="${escapeXml(t.key)}">
      <segment>
        <source>${escapedSource}</source>
        ${escapedTarget ? `<target>${escapedTarget}</target>` : ""}
      </segment>
      ${escapedNote ? `<notes><note>${escapedNote}</note></notes>` : ""}
      ${t.namespace ? `<mda:metadata><mda:metaGroup category="namespace"><mda:meta type="namespace">${escapeXml(t.namespace)}</mda:meta></mda:metaGroup></mda:metadata>` : ""}
    </unit>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="${sourceLanguage}" trgLang="${targetLanguage}">
  <file id="f1" original="">
    <skeleton href=""/>
    <group id="g1">
${units}
    </group>
  </file>
</xliff>`;
}

/**
 * Parse XLIFF 1.2 or 2.0 file
 */
export function parseXLIFF(xliffContent: string): XLIFFDocument {
  // Simple XML parsing (for production, use a proper XML parser)
  const versionMatch = xliffContent.match(/version="([^"]+)"/);
  const version = versionMatch ? (versionMatch[1] === "2.0" ? "2.0" : "1.2") : "1.2";

  const sourceLangMatch = xliffContent.match(/source-language="([^"]+)"/) || 
                          xliffContent.match(/srcLang="([^"]+)"/);
  const targetLangMatch = xliffContent.match(/target-language="([^"]+)"/) || 
                          xliffContent.match(/trgLang="([^"]+)"/);

  const sourceLanguage = sourceLangMatch?.[1] || "en";
  const targetLanguage = targetLangMatch?.[1] || "en";

  const units: XLIFFTranslationUnit[] = [];

  // Extract trans-unit (1.2) or unit (2.0) elements
  const unitRegex = version === "2.0" 
    ? /<unit[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/unit>/g
    : /<trans-unit[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g;

  let match;
  while ((match = unitRegex.exec(xliffContent)) !== null) {
    const id = match[1];
    const content = match[2];

    const sourceMatch = content.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    const targetMatch = content.match(/<target[^>]*>([\s\S]*?)<\/target>/);
    const noteMatch = content.match(/<note[^>]*>([\s\S]*?)<\/note>/);

    units.push({
      id,
      source: sourceMatch ? unescapeXml(sourceMatch[1].trim()) : "",
      target: targetMatch ? unescapeXml(targetMatch[1].trim()) : undefined,
      note: noteMatch ? unescapeXml(noteMatch[1].trim()) : undefined,
    });
  }

  return {
    version,
    sourceLanguage,
    targetLanguage,
    units,
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

