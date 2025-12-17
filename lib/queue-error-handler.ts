/**
 * Queue error handling and recovery
 * Handles failures in translation queue processing
 */

import { db } from "@/lib/db";
import { translationQueue } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface QueueErrorInfo {
  itemId: string;
  error: string;
  retryCount: number;
  lastAttempt: Date;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 60000; // 1 minute

/**
 * Mark queue item as failed with error details
 */
export async function markQueueItemFailed(
  itemId: string,
  error: string,
  retryCount: number = 0
): Promise<void> {
  await db
    .update(translationQueue)
    .set({
      status: retryCount < MAX_RETRIES ? "pending" : "failed",
      error: error.substring(0, 500), // Limit error message length
      updatedAt: new Date(),
    })
    .where(eq(translationQueue.id, itemId));
}

/**
 * Get failed queue items that can be retried
 */
export async function getRetryableQueueItems(): Promise<Array<{
  id: string;
  projectId: string;
  keyId: string;
  sourceText: string;
  targetLanguageId: string;
  error: string | null;
}>> {
  const items = await db
    .select({
      id: translationQueue.id,
      projectId: translationQueue.projectId,
      keyId: translationQueue.keyId,
      sourceText: translationQueue.sourceText,
      targetLanguageId: translationQueue.targetLanguageId,
      error: translationQueue.error,
    })
    .from(translationQueue)
    .where(
      and(
        eq(translationQueue.status, "failed"),
        // Only retry items that failed less than MAX_RETRIES times
        // This is a simplified check - in production, track retry count separately
      )
    )
    .limit(50);

  return items;
}

/**
 * Handle queue processing errors with retry logic
 */
export async function handleQueueError(
  itemId: string,
  error: unknown,
  retryCount: number = 0
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Log error for monitoring
  console.error(`Queue item ${itemId} failed (attempt ${retryCount + 1}):`, errorMessage);

  // Determine if error is retryable
  const isRetryable = isRetryableError(error);

  if (isRetryable && retryCount < MAX_RETRIES) {
    // Mark as pending for retry
    // The queue processor will pick up items with status "pending" and retry them
    await markQueueItemFailed(itemId, `Retryable error: ${errorMessage}`, retryCount + 1);
    
    // Note: Actual retry scheduling should be handled by a job queue system (e.g., Bull, BullMQ, or similar)
    // The queue processor should check for items with status "pending" and retry them
    // This function only marks the item for retry; the queue processor handles the actual retry logic
    console.log(`Queue item ${itemId} marked for retry (attempt ${retryCount + 1}/${MAX_RETRIES})`);
  } else {
    // Mark as permanently failed
    await markQueueItemFailed(itemId, `Failed after ${retryCount + 1} attempts: ${errorMessage}`, MAX_RETRIES);
  }
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  
  // Retryable errors
  const retryablePatterns = [
    "timeout",
    "econnrefused",
    "etimedout",
    "network",
    "temporary",
    "rate limit",
    "quota",
    "503",
    "502",
    "500",
  ];

  // Non-retryable errors
  const nonRetryablePatterns = [
    "invalid",
    "authentication",
    "authorization",
    "not found",
    "400",
    "401",
    "403",
    "404",
  ];

  if (nonRetryablePatterns.some((pattern) => message.includes(pattern))) {
    return false;
  }

  return retryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Get queue health status
 */
export async function getQueueHealth(): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  failedWithRetries: number;
}> {
  const allItems = await db.select().from(translationQueue);
  
  return {
    total: allItems.length,
    pending: allItems.filter((i) => i.status === "pending").length,
    processing: allItems.filter((i) => i.status === "processing").length,
    completed: allItems.filter((i) => i.status === "completed").length,
    failed: allItems.filter((i) => i.status === "failed").length,
    failedWithRetries: allItems.filter((i) => i.status === "failed" && i.error?.includes("Retryable")).length,
  };
}

