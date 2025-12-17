/**
 * Webhook event definitions and types
 */

export type WebhookEventType =
  | "translation.created"
  | "translation.updated"
  | "translation.approved"
  | "translation.rejected"
  | "key.created"
  | "key.deleted"
  | "queue.completed"
  | "queue.failed";

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  projectId: string;
  data: Record<string, any>;
}

export interface TranslationCreatedEvent extends WebhookEvent {
  type: "translation.created";
  data: {
    translationId: string;
    keyId: string;
    key: string;
    languageCode: string;
    value: string;
    state: "draft" | "review" | "approved";
    createdBy: string;
  };
}

export interface TranslationUpdatedEvent extends WebhookEvent {
  type: "translation.updated";
  data: {
    translationId: string;
    keyId: string;
    key: string;
    languageCode: string;
    oldValue: string;
    newValue: string;
    state: "draft" | "review" | "approved";
    updatedBy: string;
  };
}

export interface TranslationApprovedEvent extends WebhookEvent {
  type: "translation.approved";
  data: {
    translationId: string;
    keyId: string;
    key: string;
    languageCode: string;
    value: string;
    approvedBy: string;
  };
}

export interface TranslationRejectedEvent extends WebhookEvent {
  type: "translation.rejected";
  data: {
    translationId: string;
    keyId: string;
    key: string;
    languageCode: string;
    value: string;
    rejectedBy: string;
    reason?: string;
  };
}

export interface KeyCreatedEvent extends WebhookEvent {
  type: "key.created";
  data: {
    keyId: string;
    key: string;
    namespace?: string;
    description?: string;
    createdBy: string;
  };
}

export interface KeyDeletedEvent extends WebhookEvent {
  type: "key.deleted";
  data: {
    keyId: string;
    key: string;
    namespace?: string;
    deletedBy: string;
  };
}

export interface QueueCompletedEvent extends WebhookEvent {
  type: "queue.completed";
  data: {
    queueId: string;
    totalItems: number;
    completedItems: number;
    failedItems: number;
    completedBy?: string;
  };
}

export interface QueueFailedEvent extends WebhookEvent {
  type: "queue.failed";
  data: {
    queueId: string;
    totalItems: number;
    completedItems: number;
    failedItems: number;
    error?: string;
  };
}

export type WebhookEventPayload =
  | TranslationCreatedEvent
  | TranslationUpdatedEvent
  | TranslationApprovedEvent
  | TranslationRejectedEvent
  | KeyCreatedEvent
  | KeyDeletedEvent
  | QueueCompletedEvent
  | QueueFailedEvent;

/**
 * Create a webhook event payload
 */
export function createWebhookEvent(
  type: WebhookEventType,
  projectId: string,
  data: Record<string, any>
): WebhookEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    type,
    timestamp: new Date().toISOString(),
    projectId,
    data,
  };
}

