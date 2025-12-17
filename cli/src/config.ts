import Conf from "conf";

export interface CliConfig {
  token?: string;
  apiUrl?: string;
  currentProject?: string;
}

const config = new Conf<CliConfig>({
  projectName: "linguaflow",
  defaults: {
    apiUrl: process.env.LINGUAFLOW_API_URL || "http://localhost:3000",
  },
});

export function getConfig(): CliConfig {
  return config.store;
}

export function setConfig(updates: Partial<CliConfig>): void {
  Object.assign(config.store, updates);
}

export function clearConfig(): void {
  config.clear();
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

export function getCurrentProject(): string | undefined {
  return config.get("currentProject");
}

export function setCurrentProject(projectId: string): void {
  config.set("currentProject", projectId);
}

