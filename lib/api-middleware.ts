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
    // Limit to 100 projects to prevent loading all projects in large deployments
    // Note: In production, consider migrating old API keys to the new format
    // or adding an index/flag to identify old-format keys
    const oldProjects = await db
      .select()
      .from(projects)
      .limit(100);
    
    for (const proj of oldProjects) {
      // Skip if no hash (shouldn't happen, but defensive)
      if (!proj.apiKeyHash) continue;
      
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

