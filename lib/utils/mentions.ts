/**
 * Utility functions for parsing and handling @mentions in comments
 */

export interface MentionMatch {
  userId: string;
  userName: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Parse @mentions from text
 * Format: @username or @user@email.com
 * Returns array of user IDs that were mentioned
 */
export function parseMentions(
  text: string,
  userMap: Map<string, { id: string; name: string; email: string }>
): string[] {
  const mentionedUserIds: string[] = [];
  const mentionRegex = /@(\w+(?:@[\w.-]+)?)/g;
  const seen = new Set<string>();

  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionText = match[1].toLowerCase();

    // Try to find user by name (case-insensitive)
    for (const [userId, user] of userMap.entries()) {
      const userName = user.name?.toLowerCase() || "";
      const userEmail = user.email?.toLowerCase() || "";

      if (
        userName === mentionText ||
        userEmail === mentionText ||
        userEmail.split("@")[0] === mentionText ||
        (userEmail.includes("@") && userEmail === mentionText)
      ) {
        if (!seen.has(userId)) {
          mentionedUserIds.push(userId);
          seen.add(userId);
        }
        break;
      }
    }
  }

  return mentionedUserIds;
}

/**
 * Find users matching a search query (for autocomplete)
 */
export function findMatchingUsers(
  query: string,
  users: Array<{ id: string; name: string; email: string }>,
  limit: number = 10
): Array<{ id: string; name: string; email: string }> {
  if (!query || query.length < 1) {
    return users.slice(0, limit);
  }

  const lowerQuery = query.toLowerCase();
  const matches = users
    .filter((user) => {
      const name = user.name?.toLowerCase() || "";
      const email = user.email?.toLowerCase() || "";
      return name.includes(lowerQuery) || email.includes(lowerQuery);
    })
    .slice(0, limit);

  return matches;
}

/**
 * Highlight mentions in text
 * Returns JSX-ready content with highlighted mentions
 */
export function highlightMentions(
  text: string,
  userMap: Map<string, { id: string; name: string; email: string }>
): Array<{ type: "text" | "mention"; content: string; userId?: string }> {
  const parts: Array<{ type: "text" | "mention"; content: string; userId?: string }> = [];
  const mentionRegex = /@(\w+(?:@[\w.-]+)?)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }

    const mentionText = match[1].toLowerCase();
    let foundUserId: string | undefined;

    // Find user
    for (const [userId, user] of userMap.entries()) {
      const userName = user.name?.toLowerCase() || "";
      const userEmail = user.email?.toLowerCase() || "";

      if (
        userName === mentionText ||
        userEmail === mentionText ||
        userEmail.split("@")[0] === mentionText ||
        (userEmail.includes("@") && userEmail === mentionText)
      ) {
        foundUserId = userId;
        break;
      }
    }

    parts.push({
      type: "mention",
      content: match[0],
      userId: foundUserId,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  return parts.length > 0 ? parts : [{ type: "text", content: text }];
}

