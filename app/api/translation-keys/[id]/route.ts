import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationKeys, translations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatErrorResponse, AuthenticationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Verify key exists and get projectId
    const [key] = await db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.id, id))
      .limit(1);

    if (!key) {
      return NextResponse.json(formatErrorResponse(new Error("Translation key not found")), { status: 404 });
    }

    // Verify user has admin access to project's organization
    await verifyProjectAccess(session.user.id, key.projectId, true);

    // Dispatch webhook event before deletion
    const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatcher");
    const { createWebhookEvent } = await import("@/lib/webhooks/events");
    
    const event = createWebhookEvent("key.deleted", key.projectId, {
      keyId: key.id,
      key: key.key,
      namespace: key.namespace || undefined,
      deletedBy: session.user.id,
    });
    await dispatchWebhookEvent(key.projectId, event);

    // Delete translations first (cascade should handle this, but being explicit)
    await db.delete(translations).where(eq(translations.keyId, id));

    // Delete the key
    await db.delete(translationKeys).where(eq(translationKeys.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting translation key:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

