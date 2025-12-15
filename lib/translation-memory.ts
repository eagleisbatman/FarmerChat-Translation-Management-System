import { db } from "./db";
import { translationMemory, translations, translationKeys, languages, projects } from "./db/schema";
import { eq, and, or, sql } from "drizzle-orm";

export interface TranslationMemoryMatch {
  sourceText: string;
  targetText: string;
  similarity: number;
  usageCount: number;
}

export class TranslationMemoryService {
  /**
   * Find similar translations in memory
   */
  async findSimilar(
    sourceText: string,
    sourceLanguageId: string,
    targetLanguageId: string,
    projectId: string,
    threshold: number = 0.7
  ): Promise<TranslationMemoryMatch[]> {
    // Get all memory entries for this language pair and project
    const memories = await db
      .select()
      .from(translationMemory)
      .where(
        and(
          eq(translationMemory.sourceLanguageId, sourceLanguageId),
          eq(translationMemory.targetLanguageId, targetLanguageId),
          eq(translationMemory.projectId, projectId)
        )
      );

    // Calculate similarity using simple Levenshtein-like approach
    const matches: TranslationMemoryMatch[] = [];

    for (const memory of memories) {
      const similarity = this.calculateSimilarity(sourceText.toLowerCase(), memory.sourceText.toLowerCase());
      
      if (similarity >= threshold) {
        matches.push({
          sourceText: memory.sourceText,
          targetText: memory.targetText,
          similarity,
          usageCount: memory.usageCount,
        });
      }
    }

    // Sort by similarity and usage count
    return matches.sort((a, b) => {
      if (Math.abs(a.similarity - b.similarity) < 0.01) {
        return b.usageCount - a.usageCount;
      }
      return b.similarity - a.similarity;
    }).slice(0, 5); // Return top 5 matches
  }

  /**
   * Add approved translation to memory
   */
  async addToMemory(
    sourceText: string,
    targetText: string,
    sourceLanguageId: string,
    targetLanguageId: string,
    projectId: string
  ): Promise<void> {
    // Check if already exists
    const [existing] = await db
      .select()
      .from(translationMemory)
      .where(
        and(
          eq(translationMemory.sourceLanguageId, sourceLanguageId),
          eq(translationMemory.targetLanguageId, targetLanguageId),
          eq(translationMemory.projectId, projectId),
          sql`LOWER(${translationMemory.sourceText}) = LOWER(${sourceText})`
        )
      )
      .limit(1);

    if (existing) {
      // Update usage count
      await db
        .update(translationMemory)
        .set({
          usageCount: existing.usageCount + 1,
          targetText, // Update target text in case it changed
        })
        .where(eq(translationMemory.id, existing.id));
    } else {
      // Create new entry
      const { nanoid } = await import("nanoid");
      await db.insert(translationMemory).values({
        id: nanoid(),
        sourceLanguageId,
        targetLanguageId,
        sourceText,
        targetText,
        projectId,
        usageCount: 1,
      });
    }
  }

  /**
   * Sync approved translations to memory
   */
  async syncApprovedTranslations(projectId: string): Promise<void> {
    // Get all approved translations with their keys
    const approvedTranslations = await db
      .select({
        translation: translations,
        key: translationKeys,
        sourceLang: languages,
        targetLang: languages,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .innerJoin(languages, eq(translations.languageId, languages.id))
      .where(
        and(
          eq(translationKeys.projectId, projectId),
          eq(translations.state, "approved")
        )
      );

    // Get default language for project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project?.defaultLanguageId) {
      return;
    }

    // Group by language pairs
    const pairs = new Map<string, Array<{ source: string; target: string; sourceLang: string; targetLang: string }>>();

    for (const item of approvedTranslations) {
      const key = item.translation.keyId;
      const defaultTranslation = approvedTranslations.find(
        (t) => t.translation.keyId === key && t.translation.languageId === project.defaultLanguageId
      );

      if (defaultTranslation && item.translation.languageId !== project.defaultLanguageId) {
        const pairKey = `${project.defaultLanguageId}-${item.translation.languageId}`;
        if (!pairs.has(pairKey)) {
          pairs.set(pairKey, []);
        }
        pairs.get(pairKey)!.push({
          source: defaultTranslation.translation.value,
          target: item.translation.value,
          sourceLang: project.defaultLanguageId,
          targetLang: item.translation.languageId,
        });
      }
    }

    // Add to memory
    for (const [pairKey, translations] of pairs) {
      const [sourceLangId, targetLangId] = pairKey.split("-");
      for (const { source, target } of translations) {
        await this.addToMemory(source, target, sourceLangId, targetLangId, projectId);
      }
    }
  }

  /**
   * Calculate similarity between two strings (simple Jaro-Winkler-like)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    // Simple word-based similarity
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    
    const commonWords = words1.filter((w) => words2.includes(w));
    const totalWords = new Set([...words1, ...words2]).size;

    if (totalWords === 0) return 0.0;

    return commonWords.length / totalWords;
  }
}

