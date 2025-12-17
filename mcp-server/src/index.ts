#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  pullTranslations,
  pushTranslations,
  verifyToken,
  createTranslationKey,
  getProjectStatus,
  searchTranslations,
  bulkTranslate,
} from "./api.js";
import { getToken, getDefaultProject, getApiUrl } from "./config.js";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";

const server = new Server(
  {
    name: "linguaflow-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_translations",
        description:
          "Get translations from LinguaFlow for a project. Returns translations organized by namespace.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID (optional if default project is set)",
            },
            language: {
              type: "string",
              description: "Language code (e.g., 'en', 'es'). Optional.",
            },
            namespace: {
              type: "string",
              description: "Namespace filter. Optional.",
            },
          },
        },
      },
      {
        name: "update_translations",
        description:
          "Update translations in LinguaFlow. Automatically notifies translators if review is required.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID (optional if default project is set)",
            },
            translations: {
              type: "object",
              description:
                "Translations object with namespaces as keys and key-value pairs as values",
              additionalProperties: {
                type: "object",
                additionalProperties: { type: "string" },
              },
            },
            language: {
              type: "string",
              description: "Language code (e.g., 'en', 'es'). Optional.",
            },
            deprecate: {
              type: "array",
              items: { type: "string" },
              description:
                "Array of key paths (e.g., ['common.oldKey', 'default.deprecatedKey']) to deprecate",
            },
          },
          required: ["translations"],
        },
      },
      {
        name: "sync_translations",
        description:
          "Sync translations: pull from server, merge with local file, and push back. Detects changes automatically.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID (optional if default project is set)",
            },
            filePath: {
              type: "string",
              description:
                "Path to local translation file (default: 'translations.json')",
            },
            language: {
              type: "string",
              description: "Language code (e.g., 'en', 'es'). Optional.",
            },
            namespace: {
              type: "string",
              description: "Namespace filter. Optional.",
            },
          },
        },
      },
      {
        name: "detect_changes",
        description:
          "Detect changes between local translation file and server translations. Returns keys that differ.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID (optional if default project is set)",
            },
            filePath: {
              type: "string",
              description:
                "Path to local translation file (default: 'translations.json')",
            },
            language: {
              type: "string",
              description: "Language code (e.g., 'en', 'es'). Optional.",
            },
          },
        },
      },
      {
        name: "create_translation_key",
        description:
          "Create a new translation key in LinguaFlow. Returns the created key.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID (optional if default project is set)",
            },
            key: {
              type: "string",
              description: "Translation key identifier (e.g., 'welcome.message')",
            },
            namespace: {
              type: "string",
              description: "Namespace for organizing keys (optional)",
            },
            description: {
              type: "string",
              description: "Description of the translation key (optional)",
            },
          },
          required: ["key"],
        },
      },
      {
        name: "get_project_status",
        description:
          "Get project statistics including total keys, translations, and language completion rates.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID (optional if default project is set)",
            },
          },
        },
      },
      {
        name: "search_translations",
        description:
          "Search translations by key, value, or description. Returns matching translations.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID (optional if default project is set)",
            },
            query: {
              type: "string",
              description: "Search query (searches keys, values, and descriptions)",
            },
            language: {
              type: "string",
              description: "Filter by language code (optional)",
            },
            namespace: {
              type: "string",
              description: "Filter by namespace (optional)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "bulk_translate",
        description:
          "Trigger bulk AI translation for multiple keys and target languages. Returns queue information.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID (optional if default project is set)",
            },
            keyIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of translation key IDs to translate",
            },
            targetLanguageIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of target language IDs",
            },
          },
          required: ["keyIds", "targetLanguageIds"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Verify token before any operation
  const token = getToken();
  if (!token) {
    throw new Error(
      "Not authenticated. Please configure LinguaFlow CLI token using 'linguaflow login'."
    );
  }

  try {
    await verifyToken();
  } catch (error: any) {
    throw new Error(`Authentication failed: ${error.message}`);
  }

  const projectId = args?.projectId || getDefaultProject();
  if (!projectId && name !== "get_translations") {
    throw new Error(
      "Project ID is required. Either provide it as an argument or set a default project."
    );
  }

  switch (name) {
    case "get_translations": {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      const data = await pullTranslations(projectId, {
        lang: args?.language,
        namespace: args?.namespace,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                project: data.project,
                translations: data.translations,
                metadata: data.metadata,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "update_translations": {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      if (!args?.translations) {
        throw new Error("Translations object is required");
      }

      const deprecate = Array.isArray(args.deprecate) ? args.deprecate : undefined;

      const result = await pushTranslations(projectId, args.translations, {
        lang: args?.language,
        deprecate,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: "Translations updated successfully",
                keysCreated: result.keysCreated,
                keysUpdated: result.keysUpdated,
                translationsCreated: result.translationsCreated,
                translationsUpdated: result.translationsUpdated,
                deprecated: result.deprecated,
                note: result.translationsCreated > 0 || result.translationsUpdated > 0
                  ? "Translators have been notified if review is required."
                  : "No changes made.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "sync_translations": {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      const filePath = args?.filePath || "translations.json";
      let localTranslations: Record<string, Record<string, string>> = {};

      // Load local file if exists
      try {
        const content = await fs.readFile(filePath, "utf-8");
        localTranslations = JSON.parse(content);
      } catch {
        // File doesn't exist, will use server translations
      }

      // Pull server translations
      const serverData = await pullTranslations(projectId, {
        lang: args?.language,
        namespace: args?.namespace,
      });

      // Merge: local takes precedence
      const merged: Record<string, Record<string, string>> = {
        ...serverData.translations,
      };
      for (const [namespace, keys] of Object.entries(localTranslations)) {
        if (!merged[namespace]) {
          merged[namespace] = {};
        }
        Object.assign(merged[namespace], keys);
      }

      // Push merged translations
      const deprecate = Array.isArray(args?.deprecate) ? args.deprecate : undefined;
      const result = await pushTranslations(projectId, merged, {
        lang: args?.language,
        deprecate,
      });

      // Update local file
      await fs.writeFile(
        filePath,
        JSON.stringify(merged, null, 2),
        "utf-8"
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: "Sync completed successfully",
                keysCreated: result.keysCreated,
                keysUpdated: result.keysUpdated,
                translationsCreated: result.translationsCreated,
                translationsUpdated: result.translationsUpdated,
                deprecated: result.deprecated,
                localFileUpdated: filePath,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "detect_changes": {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      const filePath = args?.filePath || "translations.json";
      let localTranslations: Record<string, Record<string, string>> = {};

      // Load local file
      try {
        const content = await fs.readFile(filePath, "utf-8");
        localTranslations = JSON.parse(content);
      } catch (error: any) {
        throw new Error(`Failed to read local file: ${error.message}`);
      }

      // Pull server translations
      const serverData = await pullTranslations(projectId, {
        lang: args?.language,
      });

      // Compare and detect changes
      const changes: {
        added: string[];
        modified: string[];
        removed: string[];
      } = {
        added: [],
        modified: [],
        removed: [],
      };

      // Check for added/modified keys
      for (const [namespace, keys] of Object.entries(localTranslations)) {
        const serverNamespace = serverData.translations[namespace] || {};
        for (const [key, value] of Object.entries(keys)) {
          const keyPath = `${namespace}.${key}`;
          if (!(key in serverNamespace)) {
            changes.added.push(keyPath);
          } else if (serverNamespace[key] !== value) {
            changes.modified.push(keyPath);
          }
        }
      }

      // Check for removed keys
      for (const [namespace, keys] of Object.entries(serverData.translations)) {
        const localNamespace = localTranslations[namespace] || {};
        for (const key of Object.keys(keys)) {
          if (!(key in localNamespace)) {
            changes.removed.push(`${namespace}.${key}`);
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                changes,
                summary: {
                  totalChanges:
                    changes.added.length +
                    changes.modified.length +
                    changes.removed.length,
                  added: changes.added.length,
                  modified: changes.modified.length,
                  removed: changes.removed.length,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "create_translation_key": {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      if (!args?.key) {
        throw new Error("Key is required");
      }

      const result = await createTranslationKey(projectId, args.key, {
        namespace: args?.namespace,
        description: args?.description,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                key: result,
                message: "Translation key created successfully",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "get_project_status": {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      const result = await getProjectStatus(projectId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "search_translations": {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      if (!args?.query) {
        throw new Error("Search query is required");
      }

      const result = await searchTranslations(projectId, args.query, {
        language: args?.language,
        namespace: args?.namespace,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "bulk_translate": {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      if (!Array.isArray(args?.keyIds) || args.keyIds.length === 0) {
        throw new Error("keyIds array is required and must not be empty");
      }
      if (!Array.isArray(args?.targetLanguageIds) || args.targetLanguageIds.length === 0) {
        throw new Error("targetLanguageIds array is required and must not be empty");
      }

      const result = await bulkTranslate(projectId, args.keyIds, args.targetLanguageIds);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "linguaflow://config",
        name: "LinguaFlow Configuration",
        description: "Current configuration (API URL, default project)",
        mimeType: "application/json",
      },
    ],
  };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "linguaflow://config") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              apiUrl: getApiUrl(),
              defaultProject: getDefaultProject(),
              authenticated: !!getToken(),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LinguaFlow MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

