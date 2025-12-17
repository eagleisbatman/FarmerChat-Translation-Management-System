/**
 * Cache invalidation helpers
 * Call these functions when data changes to invalidate related cache entries
 */

import { Cache, CacheKeys } from "./index";

/**
 * Invalidate project cache
 */
export async function invalidateProjectCache(projectId: string): Promise<void> {
  const cache = new Cache();
  await cache.delete(CacheKeys.project(projectId));
  // Also invalidate all translation caches for this project
  // We can't easily list all language-specific keys, so we'll rely on TTL
  // For more aggressive invalidation, you could maintain a list of cache keys
}

/**
 * Invalidate translation cache for a project
 */
export async function invalidateTranslationCache(projectId: string, languageCode?: string): Promise<void> {
  const cache = new Cache();
  
  if (languageCode) {
    // Invalidate specific language cache
    await cache.delete(CacheKeys.projectTranslations(projectId, languageCode));
  } else {
    // Invalidate all language caches (we'll need to track these or use pattern matching)
    // For now, we'll rely on TTL, but in production you might want to maintain a key registry
    await cache.delete(CacheKeys.projectTranslations(projectId));
  }
}

/**
 * Invalidate analytics cache
 */
export async function invalidateAnalyticsCache(projectId: string): Promise<void> {
  const cache = new Cache();
  // Invalidate all analytics caches for this project
  await cache.delete(CacheKeys.analytics(projectId));
}

/**
 * Invalidate all caches related to a project (useful for bulk operations)
 */
export async function invalidateAllProjectCaches(projectId: string): Promise<void> {
  await Promise.all([
    invalidateProjectCache(projectId),
    invalidateTranslationCache(projectId),
    invalidateAnalyticsCache(projectId),
  ]);
}

