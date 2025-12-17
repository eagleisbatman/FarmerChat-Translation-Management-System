import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { formatErrorResponse, AuthenticationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Verify user has admin access to project's organization
    await verifyProjectAccess(session.user.id, id, true);

    // Generate new API key
    const newApiKey = `lf_${nanoid(32)}`; // LinguaFlow API key prefix
    const apiKeyHash = await bcrypt.hash(newApiKey, 10);

    const [updated] = await db
      .update(projects)
      .set({
        apiKey: newApiKey,
        apiKeyHash: apiKeyHash,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(formatErrorResponse(new Error("Project not found")), { status: 404 });
    }

    return NextResponse.json({ apiKey: newApiKey });
  } catch (error) {
    console.error("Error regenerating API key:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

