/**
 * Cache manager - provides unified cache interface with Redis fallback to memory
 */

import { MemoryCache } from "./memory";
import { RedisCache } from "./redis";
import type { CacheAdapter, CacheOptions } from "./types";

let cacheInstance: CacheAdapter | null = null;

/**
 * Get the cache instance (Redis if available, otherwise memory cache)
 */
export function getCache(): CacheAdapter {
  if (cacheInstance) {
    return cacheInstance;
  }

  const redisCache = new RedisCache();
  
  if (redisCache.isAvailable()) {
    cacheInstance = redisCache;
    console.log("Using Redis cache");
  } else {
    cacheInstance = new MemoryCache();
    console.log("Using memory cache");
  }

  return cacheInstance;
}

/**
 * Cache helper functions with automatic key prefixing
 */
export class Cache {
  private adapter: CacheAdapter;
  private prefix: string;

  constructor(prefix: string = "") {
    this.adapter = getCache();
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.adapter.get<T>(this.getKey(key));
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    return this.adapter.set<T>(this.getKey(key), value, ttl);
  }

  async delete(key: string): Promise<void> {
    return this.adapter.delete(this.getKey(key));
  }

  async clear(): Promise<void> {
    // Clear only keys with this prefix
    if (this.prefix && this.adapter instanceof MemoryCache) {
      const stats = this.adapter.getStats();
      for (const key of stats.entries) {
        if (key.startsWith(this.prefix)) {
          await this.adapter.delete(key);
        }
      }
    } else {
      await this.adapter.clear();
    }
  }

  async has(key: string): Promise<boolean> {
    return this.adapter.has(this.getKey(key));
  }
}

/**
 * Cache keys for different data types
 */
export const CacheKeys = {
  project: (projectId: string) => `project:${projectId}`,
  projectTranslations: (projectId: string, languageCode?: string) => 
    `project:${projectId}:translations${languageCode ? `:${languageCode}` : ""}`,
  translationKey: (keyId: string) => `translation-key:${keyId}`,
  language: (languageId: string) => `language:${languageId}`,
  user: (userId: string) => `user:${userId}`,
  organization: (orgId: string) => `organization:${orgId}`,
  analytics: (projectId: string, dateRange?: string) => 
    `analytics:${projectId}${dateRange ? `:${dateRange}` : ""}`,
} as const;

/**
 * Cache TTL constants (in seconds)
 */
export const CacheTTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

