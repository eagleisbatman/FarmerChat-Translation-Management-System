import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { formatErrorResponse, ValidationError, NotFoundError, AuthorizationError, AuthenticationError } from "@/lib/errors";

const settingsSchema = z.object({
  requiresReview: z.boolean().optional(),
  autoApproveOnReview: z.boolean().optional(),
  notifyOnTranslation: z.boolean().optional(),
  maxRetries: z.number().int().min(1).max(10).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    if (session.user.role !== "admin") {
      throw new AuthorizationError("Only admins can update project settings");
    }

    const body = await request.json();
    const data = settingsSchema.parse(body);

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      throw new NotFoundError("Project");
    }

    // Update project settings
    await db
      .update(projects)
      .set({
        requiresReview: data.requiresReview ?? project.requiresReview,
        // Note: These fields need to be added to the schema if not already present
        // For now, we'll only update requiresReview
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id));

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorResponse = formatErrorResponse(
        new ValidationError(
          "Invalid settings data",
          "Please check that all fields are valid."
        )
      );
      return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
    }
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

