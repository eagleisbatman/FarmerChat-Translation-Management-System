import { NextRequest } from "next/server";
import { db } from "./db";
import { projects } from "./db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function validateApiKey(request: NextRequest): Promise<{
  valid: boolean;
  projectId?: string;
  error?: string;
}> {
  const apiKey =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    request.nextUrl.searchParams.get("api_key");

  if (!apiKey) {
    return { valid: false, error: "API key is required. Provide it via X-API-Key header, Authorization header, or api_key query parameter." };
  }

  try {
    // Optimized: Query directly by apiKey (indexed, unique constraint)
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.apiKey, apiKey))
      .limit(1);

    if (project) {
      return { valid: true, projectId: project.id };
    }

    // Backward compatibility: Check hash for old API keys
    // This is slower but only runs if direct match fails
    const allProjects = await db.select().from(projects);
    for (const proj of allProjects) {
      try {
        const isValid = await bcrypt.compare(apiKey, proj.apiKeyHash);
        if (isValid) {
          return { valid: true, projectId: proj.id };
        }
      } catch {
        // Ignore bcrypt errors (invalid hash format, etc.)
      }
    }

    return { valid: false, error: "Invalid API key" };
  } catch (error) {
    console.error("Error validating API key:", error);
    return { valid: false, error: "Error validating API key" };
  }
}

