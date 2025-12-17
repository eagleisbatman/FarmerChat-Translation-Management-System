import { NotificationService } from "./service";
import { db } from "@/lib/db";
import { translations, translationKeys, projects, projectMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const notificationService = new NotificationService();

/**
 * Notify reviewers when a translation needs review
 */
export async function notifyReviewRequest(
  translationId: string,
  projectId: string
): Promise<void> {
  try {
    // Get translation details
    const [translation] = await db
      .select({
        translation: translations,
        key: translationKeys,
        project: projects,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .innerJoin(projects, eq(translationKeys.projectId, projects.id))
      .where(eq(translations.id, translationId))
      .limit(1);

    if (!translation) return;

    // Get project reviewers
    const reviewers = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.role, "reviewer")
        )
      );

    // Also include system reviewers (users with reviewer role)
    const systemReviewers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "reviewer"));

    const reviewerIds = [
      ...reviewers.map((r) => r.userId),
      ...systemReviewers.map((r) => r.id),
    ];

    // Create notifications for each reviewer
    for (const reviewerId of reviewerIds) {
      await notificationService.createNotification({
        userId: reviewerId,
        type: "review_request",
        title: "Translation Review Requested",
        message: `Translation for "${translation.key.key}" needs review in project "${translation.project.name}"`,
        link: `/projects/${projectId}/translations?key=${translation.key.id}`,
        metadata: {
          translationId,
          projectId,
          keyId: translation.key.id,
        },
      });
    }
  } catch (error) {
    console.error("Error notifying review request:", error);
  }
}

/**
 * Notify translator when translation is approved
 */
export async function notifyTranslationApproved(
  translationId: string,
  projectId: string
): Promise<void> {
  try {
    const [translation] = await db
      .select({
        translation: translations,
        key: translationKeys,
        project: projects,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .innerJoin(projects, eq(translationKeys.projectId, projects.id))
      .where(eq(translations.id, translationId))
      .limit(1);

    if (!translation) return;

    await notificationService.createNotification({
      userId: translation.translation.createdBy,
      type: "translation_approved",
      title: "Translation Approved",
      message: `Your translation for "${translation.key.key}" has been approved in project "${translation.project.name}"`,
      link: `/projects/${projectId}/translations?key=${translation.key.id}`,
      metadata: {
        translationId,
        projectId,
        keyId: translation.key.id,
      },
    });
  } catch (error) {
    console.error("Error notifying translation approved:", error);
  }
}

/**
 * Notify translator when translation is rejected
 */
export async function notifyTranslationRejected(
  translationId: string,
  projectId: string,
  reason?: string
): Promise<void> {
  try {
    const [translation] = await db
      .select({
        translation: translations,
        key: translationKeys,
        project: projects,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .innerJoin(projects, eq(translationKeys.projectId, projects.id))
      .where(eq(translations.id, translationId))
      .limit(1);

    if (!translation) return;

    await notificationService.createNotification({
      userId: translation.translation.createdBy,
      type: "translation_rejected",
      title: "Translation Rejected",
      message: `Your translation for "${translation.key.key}" was rejected${reason ? `: ${reason}` : ""} in project "${translation.project.name}"`,
      link: `/projects/${projectId}/translations?key=${translation.key.id}`,
      metadata: {
        translationId,
        projectId,
        keyId: translation.key.id,
        reason,
      },
    });
  } catch (error) {
    console.error("Error notifying translation rejected:", error);
  }
}

/**
 * Notify user when translation queue is completed
 */
export async function notifyQueueCompleted(
  userId: string,
  projectId: string,
  completedCount: number,
  failedCount: number
): Promise<void> {
  try {
    await notificationService.createNotification({
      userId,
      type: "queue_completed",
      title: "Translation Queue Completed",
      message: `Bulk translation completed: ${completedCount} succeeded${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
      link: `/projects/${projectId}/queue`,
      metadata: {
        projectId,
        completedCount,
        failedCount,
      },
    });
  } catch (error) {
    console.error("Error notifying queue completed:", error);
  }
}

/**
 * Notify user when mentioned in a comment
 */
export async function notifyCommentMention(
  mentionedUserId: string,
  commentId: string,
  translationId: string,
  projectId: string,
  mentionedBy: string
): Promise<void> {
  try {
    const [translation] = await db
      .select({
        translation: translations,
        key: translationKeys,
        project: projects,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .innerJoin(projects, eq(translationKeys.projectId, projects.id))
      .where(eq(translations.id, translationId))
      .limit(1);

    if (!translation) return;

    const [mentionedByUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, mentionedBy))
      .limit(1);

    await notificationService.createNotification({
      userId: mentionedUserId,
      type: "comment_mention",
      title: "You were mentioned",
      message: `${mentionedByUser?.name || "Someone"} mentioned you in a comment on translation "${translation.key.key}"`,
      link: `/projects/${projectId}/translations?key=${translation.key.id}&comment=${commentId}`,
      metadata: {
        commentId,
        translationId,
        projectId,
        keyId: translation.key.id,
        mentionedBy,
      },
    });
  } catch (error) {
    console.error("Error notifying comment mention:", error);
  }
}

