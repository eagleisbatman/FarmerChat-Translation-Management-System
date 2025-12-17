import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, organizationMembers } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyOrganizationAccess, getUserOrganizations } from "@/lib/security/organization-access";

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  defaultLanguageId: z.string().optional(),
  requiresReview: z.boolean().default(true),
  aiProvider: z.enum(["openai", "gemini", "google-translate"]).optional(),
  aiFallbackProvider: z.enum(["openai", "gemini", "google-translate"]).optional(),
  organizationId: z.string().min(1), // Required for multi-tenant
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Get all organizations user belongs to
    const userOrgs = await getUserOrganizations(session.user.id);
    const orgIds = userOrgs.map((o) => o.organization.id);

    if (orgIds.length === 0) {
      // User has no organizations, return empty array
      return NextResponse.json([]);
    }

    // Filter projects by user's organizations
    const userProjects = await db
      .select()
      .from(projects)
      .where(inArray(projects.organizationId, orgIds));

    return NextResponse.json(userProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const body = await request.json();
    const data = createProjectSchema.parse(body);

    // Verify user has admin access to the organization
    await verifyOrganizationAccess(session.user.id, data.organizationId, true);

    // Generate API key
    const apiKey = `lf_${nanoid(32)}`; // LinguaFlow API key prefix
    const apiKeyHash = await bcrypt.hash(apiKey, 10);

    const projectId = nanoid();

    const [newProject] = await db
      .insert(projects)
      .values({
        id: projectId,
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        defaultLanguageId: data.defaultLanguageId,
        requiresReview: data.requiresReview,
        aiProvider: data.aiProvider || null,
        aiFallbackProvider: data.aiFallbackProvider || null,
        apiKey: apiKey,
        apiKeyHash: apiKeyHash,
      })
      .returning();

    return NextResponse.json({ ...newProject, apiKey }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error creating project:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

