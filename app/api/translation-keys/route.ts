import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

const createKeySchema = z.object({
  projectId: z.string(),
  key: z.string().min(1).max(255),
  description: z.string().optional(),
  namespace: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "translator") {
      return NextResponse.json(formatErrorResponse(new Error("Forbidden")), { status: 403 });
    }

    const body = await request.json();
    const data = createKeySchema.parse(body);

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, data.projectId);

    // Check if key already exists
    const existingKeys = await db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.projectId, data.projectId));
    
    const existing = existingKeys.find((k) => k.key === data.key);

    if (existing) {
      return NextResponse.json(
        { error: "Translation key already exists" },
        { status: 409 }
      );
    }

    const [newKey] = await db
      .insert(translationKeys)
      .values({
        id: nanoid(),
        projectId: data.projectId,
        key: data.key,
        description: data.description,
        namespace: data.namespace,
      })
      .returning();

    // Dispatch webhook event for key creation
    const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatcher");
    const { createWebhookEvent } = await import("@/lib/webhooks/events");
    
    const event = createWebhookEvent("key.created", data.projectId, {
      keyId: newKey.id,
      key: newKey.key,
      namespace: newKey.namespace || undefined,
      description: newKey.description || undefined,
      createdBy: session.user.id,
    });
    await dispatchWebhookEvent(data.projectId, event);

    return NextResponse.json(newKey, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error creating translation key:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(formatErrorResponse(new ValidationError("projectId is required")), { status: 400 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, projectId);

    const keys = await db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.projectId, projectId));

    return NextResponse.json(keys);
  } catch (error) {
    console.error("Error fetching translation keys:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

