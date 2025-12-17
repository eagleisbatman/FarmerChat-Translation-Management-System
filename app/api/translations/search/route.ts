import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationKeys, translations, languages, projects, translationStateEnum } from "@/lib/db/schema";
import { eq, and, or, like, sql, inArray } from "drizzle-orm";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

type TranslationState = "draft" | "review" | "approved";

/**
 * Advanced search endpoint with full-text search support
 * GET /api/translations/search?projectId=xxx&q=query&fields=key,value&lang=en&namespace=common
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");
    const query = searchParams.get("q") || "";
    const fields = searchParams.get("fields")?.split(",") || ["key", "value", "description"];
    const lang = searchParams.get("lang");
    const namespace = searchParams.get("namespace");
    const state = searchParams.get("state");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!projectId) {
      return NextResponse.json(formatErrorResponse(new ValidationError("projectId is required")), { status: 400 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, projectId);

    // Build conditions
    const conditions = [eq(translationKeys.projectId, projectId)];

    if (namespace) {
      conditions.push(eq(translationKeys.namespace, namespace));
    }

    if (state) {
      // Validate state is a valid translation state
      const validStates: TranslationState[] = ["draft", "review", "approved"];
      if (validStates.includes(state as TranslationState)) {
        conditions.push(eq(translations.state, state as TranslationState));
      }
    }

    if (lang) {
      const [language] = await db
        .select()
        .from(languages)
        .where(eq(languages.code, lang))
        .limit(1);

      if (language) {
        conditions.push(eq(translations.languageId, language.id));
      }
    }

    // Full-text search using PostgreSQL
    let searchConditions: any[] = [];

    if (query.trim()) {
      // Parse query for advanced syntax
      // Support: key:value, "exact phrase", AND, OR, NOT operators
      const searchTerms = parseSearchQuery(query, fields);

      // Build search conditions
      for (const term of searchTerms) {
        if (term.type === "field") {
          // Field-specific search (e.g., key:value)
          if (term.field === "key") {
            searchConditions.push(like(translationKeys.key, `%${term.value}%`));
          } else if (term.field === "description") {
            searchConditions.push(like(translationKeys.description, `%${term.value}%`));
          } else if (term.field === "namespace") {
            searchConditions.push(like(translationKeys.namespace, `%${term.value}%`));
          } else if (term.field === "value") {
            searchConditions.push(like(translations.value, `%${term.value}%`));
          }
        } else {
          // General search across specified fields
          const fieldConditions: any[] = [];
          
          if (fields.includes("key")) {
            fieldConditions.push(like(translationKeys.key, `%${term.value}%`));
          }
          if (fields.includes("description")) {
            fieldConditions.push(like(translationKeys.description, `%${term.value}%`));
          }
          if (fields.includes("namespace")) {
            fieldConditions.push(like(translationKeys.namespace, `%${term.value}%`));
          }
          if (fields.includes("value")) {
            fieldConditions.push(like(translations.value, `%${term.value}%`));
          }

          if (fieldConditions.length > 0) {
            if (term.operator === "NOT") {
              // For NOT, we need to exclude matches
              // This is complex with Drizzle, so we'll handle it differently
              searchConditions.push(sql`NOT (${or(...fieldConditions)})`);
            } else {
              searchConditions.push(or(...fieldConditions));
            }
          }
        }
      }

      // Combine search conditions based on operators
      if (searchConditions.length > 0) {
        // For now, use AND logic (all terms must match)
        // More complex OR/NOT logic can be added later
        conditions.push(and(...searchConditions));
      }
    }

    // Execute search
    const results = await db
      .select({
        keyId: translationKeys.id,
        key: translationKeys.key,
        namespace: translationKeys.namespace,
        description: translationKeys.description,
        translationId: translations.id,
        value: translations.value,
        state: translations.state,
        language: languages.code,
        languageName: languages.name,
      })
      .from(translationKeys)
      .innerJoin(translations, eq(translations.keyId, translationKeys.id))
      .innerJoin(languages, eq(translations.languageId, languages.id))
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(translationKeys)
      .innerJoin(translations, eq(translations.keyId, translationKeys.id))
      .innerJoin(languages, eq(translations.languageId, languages.id))
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    return NextResponse.json({
      results,
      total,
      limit,
      offset,
      hasMore: offset + results.length < total,
    });
  } catch (error) {
    console.error("Error searching translations:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * Parse search query for advanced syntax
 * Supports: key:value, "exact phrase", AND, OR, NOT
 */
function parseSearchQuery(
  query: string,
  defaultFields: string[]
): Array<{
  type: "field" | "general";
  field?: string;
  value: string;
  operator?: "AND" | "OR" | "NOT";
}> {
  const terms: Array<{
    type: "field" | "general";
    field?: string;
    value: string;
    operator?: "AND" | "OR" | "NOT";
  }> = [];

  // Split by operators (simple implementation)
  const parts = query.split(/\s+(AND|OR|NOT)\s+/i);
  let currentOperator: "AND" | "OR" | "NOT" | undefined = undefined;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    
    if (part.toUpperCase() === "AND" || part.toUpperCase() === "OR" || part.toUpperCase() === "NOT") {
      currentOperator = part.toUpperCase() as "AND" | "OR" | "NOT";
      continue;
    }

    // Check for field-specific search (key:value)
    const fieldMatch = part.match(/^(\w+):(.+)$/);
    if (fieldMatch) {
      const [, field, value] = fieldMatch;
      terms.push({
        type: "field",
        field: field.toLowerCase(),
        value: value.replace(/^"|"$/g, ""), // Remove quotes
        operator: currentOperator,
      });
    } else {
      // General search
      const value = part.replace(/^"|"$/g, ""); // Remove quotes for exact phrase
      terms.push({
        type: "general",
        value,
        operator: currentOperator,
      });
    }

    currentOperator = undefined;
  }

  return terms;
}

