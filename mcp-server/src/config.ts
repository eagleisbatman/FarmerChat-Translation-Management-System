import Conf from "conf";
import * as path from "path";
import * as os from "os";

export interface McpConfig {
  token?: string;
  apiUrl?: string;
  defaultProject?: string;
}

// Try to read from CLI config first, fallback to MCP-specific config
function getCliConfigPath(): string {
  const platform = process.platform;
  const homeDir = os.homedir();
  
  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Preferences", "linguaflow-nodejs", "config.json");
  } else if (platform === "linux") {
    return path.join(homeDir, ".config", "linguaflow", "config.json");
  } else {
    // Windows
    return path.join(process.env.APPDATA || homeDir, "linguaflow", "config.json");
  }
}

// Try to load CLI config first
let cliConfig: any = null;
try {
  const fs = require("fs");
  const cliConfigPath = getCliConfigPath();
  if (fs.existsSync(cliConfigPath)) {
    cliConfig = JSON.parse(fs.readFileSync(cliConfigPath, "utf-8"));
  }
} catch {
  // Ignore errors, will use MCP-specific config
}

const config = new Conf<McpConfig>({
  projectName: "linguaflow-mcp",
  defaults: {
    apiUrl: process.env.LINGUAFLOW_API_URL || cliConfig?.apiUrl || "http://localhost:3000",
    token: cliConfig?.token, // Use CLI token if available
    defaultProject: cliConfig?.currentProject, // Use CLI default project if available
  },
});

export function getConfig(): McpConfig {
  return config.store;
}

export function setConfig(updates: Partial<McpConfig>): void {
  Object.assign(config.store, updates);
}

export function getToken(): string | undefined {
  return config.get("token");
}

export function setToken(token: string): void {
  config.set("token", token);
}

export function getApiUrl(): string {
  return config.get("apiUrl") || "http://localhost:3000";
}

export function setApiUrl(url: string): void {
  config.set("apiUrl", url);
}

export function getDefaultProject(): string | undefined {
  return config.get("defaultProject");
}

export function setDefaultProject(projectId: string): void {
  config.set("defaultProject", projectId);
}

