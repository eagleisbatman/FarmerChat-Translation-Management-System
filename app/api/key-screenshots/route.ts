import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { keyScreenshots, translationKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError, NotFoundError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

const createScreenshotSchema = z.object({
  keyId: z.string(),
  imageUrl: z.string().url(),
  altText: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const body = await request.json();
    const data = createScreenshotSchema.parse(body);

    // Verify key exists and user has access to project
    const [key] = await db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.id, data.keyId))
      .limit(1);

    if (!key) {
      return NextResponse.json(formatErrorResponse(new NotFoundError("Translation key")), { status: 404 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, key.projectId);

    const [screenshot] = await db
      .insert(keyScreenshots)
      .values({
        id: nanoid(),
        keyId: data.keyId,
        imageUrl: data.imageUrl,
        altText: data.altText,
        uploadedBy: session.user.id,
      })
      .returning();

    return NextResponse.json(screenshot, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error creating screenshot:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const keyId = request.nextUrl.searchParams.get("keyId");

    if (!keyId) {
      return NextResponse.json(formatErrorResponse(new ValidationError("keyId is required")), { status: 400 });
    }

    // Verify key exists and user has access to project
    const [key] = await db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.id, keyId))
      .limit(1);

    if (!key) {
      return NextResponse.json(formatErrorResponse(new NotFoundError("Translation key")), { status: 404 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, key.projectId);

    const screenshots = await db
      .select()
      .from(keyScreenshots)
      .where(eq(keyScreenshots.keyId, keyId));

    return NextResponse.json(screenshots);
  } catch (error) {
    console.error("Error fetching screenshots:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

