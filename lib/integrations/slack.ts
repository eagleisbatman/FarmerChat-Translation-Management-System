/**
 * Slack integration utilities
 */

import type { WebhookEvent } from "@/lib/webhooks/events";

export interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  channel?: string;
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
}

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  accessory?: any;
}

/**
 * Format a webhook event as a Slack message
 */
export function formatSlackMessage(event: WebhookEvent): SlackMessage {
  const baseMessage: SlackMessage = {
    username: "LinguaFlow",
    icon_emoji: ":globe_with_meridians:",
  };

  switch (event.type) {
    case "translation.created":
      return {
        ...baseMessage,
        text: `New translation created`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "✨ New Translation Created",
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Key:*\n\`${event.data.key}\``,
              },
              {
                type: "mrkdwn",
                text: `*Language:*\n${event.data.languageCode}`,
              },
              {
                type: "mrkdwn",
                text: `*Value:*\n${event.data.value.substring(0, 100)}${event.data.value.length > 100 ? "..." : ""}`,
              },
              {
                type: "mrkdwn",
                text: `*State:*\n${event.data.state}`,
              },
            ],
          },
        ],
      };

    case "translation.approved":
      return {
        ...baseMessage,
        text: `Translation approved`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "✅ Translation Approved",
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Key:*\n\`${event.data.key}\``,
              },
              {
                type: "mrkdwn",
                text: `*Language:*\n${event.data.languageCode}`,
              },
              {
                type: "mrkdwn",
                text: `*Approved by:*\n<@${event.data.approvedBy}>`,
              },
            ],
          },
        ],
      };

    case "translation.rejected":
      return {
        ...baseMessage,
        text: `Translation rejected`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "❌ Translation Rejected",
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Key:*\n\`${event.data.key}\``,
              },
              {
                type: "mrkdwn",
                text: `*Language:*\n${event.data.languageCode}`,
              },
              {
                type: "mrkdwn",
                text: `*Rejected by:*\n<@${event.data.rejectedBy}>`,
              },
            ],
          },
        ],
      };

    case "queue.completed":
      return {
        ...baseMessage,
        text: `Translation queue completed`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🚀 Translation Queue Completed",
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Total Items:*\n${event.data.totalItems}`,
              },
              {
                type: "mrkdwn",
                text: `*Completed:*\n${event.data.completedItems}`,
              },
              {
                type: "mrkdwn",
                text: `*Failed:*\n${event.data.failedItems}`,
              },
            ],
          },
        ],
      };

    default:
      return {
        ...baseMessage,
        text: `Event: ${event.type}`,
      };
  }
}

/**
 * Send a message to Slack via webhook URL
 */
export async function sendSlackWebhook(webhookUrl: string, message: SlackMessage): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Send a message to Slack via Bot API
 */
export async function sendSlackMessage(
  botToken: string,
  channel: string,
  message: SlackMessage
): Promise<void> {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      ...message,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }
}

