import fetch from "node-fetch";
import { getApiUrl, getToken } from "./config";

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

  if (!token) {
    throw new Error("Not authenticated. Please configure LinguaFlow CLI token.");
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

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

export async function verifyToken(): Promise<{ valid: boolean; user: any }> {
  return request("/api/cli/auth");
}

export async function createTranslationKey(
  projectId: string,
  key: string,
  options: { namespace?: string; description?: string } = {}
): Promise<{ id: string; key: string; namespace?: string; description?: string }> {
  return request("/api/translation-keys", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      key,
      namespace: options.namespace,
      description: options.description,
    }),
  });
}

export async function getProjectStatus(projectId: string): Promise<{
  project: { id: string; name: string; description?: string };
  stats: {
    totalKeys: number;
    totalTranslations: number;
    languages: Array<{ code: string; name: string; completion: number }>;
  };
}> {
  const project = await request<{ id: string; name: string; description?: string }>(`/api/projects/${projectId}`);
  
  // Get analytics data which includes comprehensive stats
  try {
    const analytics = await request<{
      totalKeys: number;
      totalTranslations: number;
      completionRates: Array<{ languageCode: string; languageName: string; completion: number }>;
    }>(`/api/projects/${projectId}/analytics`);

    return {
      project,
      stats: {
        totalKeys: analytics.totalKeys,
        totalTranslations: analytics.totalTranslations,
        languages: analytics.completionRates.map((rate) => ({
          code: rate.languageCode,
          name: rate.languageName,
          completion: rate.completion,
        })),
      },
    };
  } catch {
    // Fallback if analytics endpoint fails
    const keys = await request<Array<{ id: string; key: string }>>(`/api/translation-keys?projectId=${projectId}`);
    const languages = await request<Array<{ id: string; code: string; name: string }>>(`/api/projects/${projectId}/languages`);
    
    return {
      project,
      stats: {
        totalKeys: keys.length,
        totalTranslations: 0,
        languages: languages.map((lang) => ({
          code: lang.code,
          name: lang.name,
          completion: 0,
        })),
      },
    };
  }
}

export async function searchTranslations(
  projectId: string,
  query: string,
  options: { language?: string; namespace?: string } = {}
): Promise<{
  results: Array<{ key: string; value: string; language: string; namespace?: string }>;
  total: number;
}> {
  const params = new URLSearchParams({ projectId, q: query });
  if (options.language) params.append("lang", options.language);
  if (options.namespace) params.append("namespace", options.namespace);

  const response = await request<{
    results: Array<{
      keyId: string;
      key: string;
      namespace?: string;
      description?: string;
      translationId: string;
      value: string;
      state: string;
      language: string;
      languageName: string;
    }>;
    total: number;
    limit: number;
    offset: number;
  }>(`/api/translations/search?${params.toString()}`);

  return {
    results: response.results.map((r) => ({
      key: r.key,
      value: r.value,
      language: r.language,
      namespace: r.namespace,
    })),
    total: response.total,
  };
}

export async function bulkTranslate(
  projectId: string,
  keyIds: string[],
  targetLanguageIds: string[]
): Promise<{
  success: boolean;
  queueId?: string;
  message: string;
}> {
  return request("/api/translation-queue", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      keyIds,
      targetLanguageIds,
    }),
  });
}

