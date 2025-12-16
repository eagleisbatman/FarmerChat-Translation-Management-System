/**
 * Figma integration for importing translations
 * Supports Figma API for fetching text strings from designs
 */

export interface FigmaConfig {
  accessToken: string;
  fileKey: string;
  nodeIds?: string[]; // Optional: specific node IDs to extract
}

export interface FigmaTextNode {
  id: string;
  name: string;
  characters: string;
  style?: {
    fontFamily?: string;
    fontSize?: number;
  };
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Fetch text nodes from Figma file
 */
export async function fetchFigmaTextNodes(config: FigmaConfig): Promise<FigmaTextNode[]> {
  const { accessToken, fileKey, nodeIds } = config;

  try {
    // If specific node IDs provided, use /v1/files/:key/nodes endpoint
    if (nodeIds && nodeIds.length > 0) {
      const response = await fetch(
        `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIds.join(",")}`,
        {
          headers: {
            "X-Figma-Token": accessToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Figma API error: ${response.statusText}`);
      }

      const data = await response.json();
      return extractTextNodes(data.nodes);
    }

    // Otherwise, fetch entire file and extract text nodes
    const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: {
        "X-Figma-Token": accessToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Figma API error: ${response.statusText}`);
    }

    const data = await response.json();
    return extractTextNodesFromDocument(data.document);
  } catch (error) {
    console.error("Error fetching Figma data:", error);
    throw error;
  }
}

/**
 * Extract text nodes from Figma API response
 */
function extractTextNodes(nodes: Record<string, { document: any }>): FigmaTextNode[] {
  const textNodes: FigmaTextNode[] = [];

  for (const [nodeId, nodeData] of Object.entries(nodes)) {
    if (nodeData.document) {
      extractTextNodesRecursive(nodeData.document, textNodes);
    }
  }

  return textNodes;
}

/**
 * Extract text nodes from Figma document recursively
 */
function extractTextNodesRecursive(node: any, textNodes: FigmaTextNode[]): void {
  if (node.type === "TEXT" && node.characters) {
    textNodes.push({
      id: node.id,
      name: node.name || "",
      characters: node.characters,
      style: node.style ? {
        fontFamily: node.style.fontFamily,
        fontSize: node.style.fontSize,
      } : undefined,
      bounds: node.absoluteBoundingBox ? {
        x: node.absoluteBoundingBox.x,
        y: node.absoluteBoundingBox.y,
        width: node.absoluteBoundingBox.width,
        height: node.absoluteBoundingBox.height,
      } : undefined,
    });
  }

  if (node.children) {
    for (const child of node.children) {
      extractTextNodesRecursive(child, textNodes);
    }
  }
}

/**
 * Extract text nodes from entire document
 */
function extractTextNodesFromDocument(document: any): FigmaTextNode[] {
  const textNodes: FigmaTextNode[] = [];
  extractTextNodesRecursive(document, textNodes);
  return textNodes;
}

/**
 * Convert Figma text nodes to translation keys format
 */
export function figmaNodesToTranslationKeys(
  nodes: FigmaTextNode[],
  projectId: string,
  namespace?: string
): Array<{
  key: string;
  description?: string;
  namespace?: string;
  sourceText: string;
}> {
  return nodes.map((node, index) => ({
    key: `figma_${node.id}` || `figma_text_${index}`,
    description: `Figma text node: ${node.name}`,
    namespace: namespace || "figma",
    sourceText: node.characters,
  }));
}

