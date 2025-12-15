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
    const allProjects = await db.select().from(projects);

    for (const project of allProjects) {
      // Compare with stored API key (plain text) or hash
      if (project.apiKey === apiKey) {
        return { valid: true, projectId: project.id };
      }
      
      // Also check hash for backward compatibility
      try {
        const isValid = await bcrypt.compare(apiKey, project.apiKeyHash);
        if (isValid) {
          return { valid: true, projectId: project.id };
        }
      } catch {
        // Ignore bcrypt errors
      }
    }

    return { valid: false, error: "Invalid API key" };
  } catch (error) {
    console.error("Error validating API key:", error);
    return { valid: false, error: "Error validating API key" };
  }
}

