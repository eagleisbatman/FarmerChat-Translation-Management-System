# LinguaFlow MCP Server

Model Context Protocol (MCP) server for integrating LinguaFlow with AI assistants like Cursor, Claude Code, and other agentic IDEs.

## Installation

```bash
npm install -g @linguaflow/mcp-server
```

Or install from source:

```bash
cd mcp-server
npm install
npm run build
npm link
```

## Configuration

The MCP server uses the same authentication as the CLI tool. After logging in with the CLI:

```bash
linguaflow login
```

The MCP server will automatically use the stored token.

## Setup in Cursor/Claude Code

### Cursor

Add to your Cursor settings (`~/.cursor/mcp.json` or workspace settings):

```json
{
  "mcpServers": {
    "linguaflow": {
      "command": "node",
      "args": ["/path/to/@linguaflow/mcp-server/dist/index.js"],
      "env": {
        "LINGUAFLOW_API_URL": "https://your-instance.com"
      }
    }
  }
}
```

### Claude Code / Other IDEs

Configure the MCP server in your IDE's settings to use:
- **Command**: `node`
- **Args**: `[path/to/@linguaflow/mcp-server/dist/index.js]`
- **Transport**: stdio

## Available Tools

### `get_translations`

Get translations from LinguaFlow for a project.

**Parameters:**
- `projectId` (string, optional): Project ID (uses default if not provided)
- `language` (string, optional): Language code filter
- `namespace` (string, optional): Namespace filter

**Returns:** Translations object with namespaces and metadata

### `update_translations`

Update translations in LinguaFlow. Automatically notifies translators if review is required.

**Parameters:**
- `projectId` (string, optional): Project ID
- `translations` (object, required): Translations object with namespaces
- `language` (string, optional): Language code
- `deprecate` (array, optional): Array of key paths to deprecate

**Returns:** Update results with counts

### `sync_translations`

Sync translations: pull from server, merge with local file, and push back.

**Parameters:**
- `projectId` (string, optional): Project ID
- `filePath` (string, optional): Path to local translation file
- `language` (string, optional): Language code
- `namespace` (string, optional): Namespace filter

**Returns:** Sync results

### `detect_changes`

Detect changes between local translation file and server translations.

**Parameters:**
- `projectId` (string, optional): Project ID
- `filePath` (string, optional): Path to local translation file
- `language` (string, optional): Language code

**Returns:** Changes summary (added, modified, removed keys)

## Example Usage in AI Assistant

```
User: "Update the English translations in my app to match the latest labels"

Assistant: I'll sync your translations with LinguaFlow.

[Uses detect_changes tool]
[Uses sync_translations tool]

Assistant: I've updated 15 translations and created 3 new keys. 
Translators have been notified for review.
```

## Resources

- `linguaflow://config` - View current configuration (API URL, default project, auth status)

## Integration Notes

- The MCP server automatically uses the CLI token for authentication
- Changes trigger notifications to translators if review workflow is enabled
- Deprecated keys are automatically marked
- The server detects and merges changes intelligently

