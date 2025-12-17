import fetch from "node-fetch";
import { getApiUrl, getToken } from "./config";
import chalk from "chalk";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiUrl = getApiUrl();
  const token = getToken();

  if (!token && !endpoint.includes("/login") && !endpoint.includes("/callback")) {
    throw new Error("Not authenticated. Run 'linguaflow login' first.");
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.message || error.error || `HTTP ${response.status}`,
      response.status,
      error.code
    );
  }

  return response.json() as Promise<T>;
}

export async function verifyToken(): Promise<{ valid: boolean; user: any }> {
  return request("/api/cli/auth");
}

export async function generateToken(cookies?: string): Promise<{
  token: string;
  expiresAt: string;
  user: any;
}> {
  const headers: HeadersInit = {};
  if (cookies) {
    headers["Cookie"] = cookies;
  }
  return request("/api/cli/auth", { method: "POST", headers });
}

export async function getLoginUrl(): Promise<{ loginUrl: string; message: string }> {
  return request("/api/cli/login");
}

export async function pullTranslations(
  projectId: string,
  options: { lang?: string; namespace?: string } = {}
): Promise<{
  translations: Record<string, Record<string, string>>;
  metadata: Record<string, any>;
  project: { id: string; name: string };
}> {
  const params = new URLSearchParams({ projectId });
  if (options.lang) params.append("lang", options.lang);
  if (options.namespace) params.append("namespace", options.namespace);

  return request(`/api/cli/sync?${params.toString()}`);
}

export async function pushTranslations(
  projectId: string,
  translations: Record<string, Record<string, string>>,
  options: { lang?: string; deprecate?: string[] } = {}
): Promise<{
  success: boolean;
  keysCreated: number;
  keysUpdated: number;
  translationsCreated: number;
  translationsUpdated: number;
  deprecated: number;
}> {
  return request("/api/cli/sync", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      translations,
      lang: options.lang,
      deprecate: options.deprecate,
    }),
  });
}

