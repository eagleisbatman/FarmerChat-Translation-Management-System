import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import { pushTranslations } from "../api";
import { getCurrentProject } from "../config";
import chalk from "chalk";

async function loadTranslationsFromFile(filePath: string): Promise<Record<string, Record<string, string>>> {
  const content = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(content);
  
  // Ensure it's the right format
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid translation file format");
  }
  
  return data;
}

export async function pushCommand(
  projectId: string | undefined,
  options: { 
    file?: string; 
    lang?: string; 
    deprecate?: string;
    pattern?: string;
  }
): Promise<void> {
  const targetProjectId = projectId || getCurrentProject();
  
  if (!targetProjectId) {
    console.error(chalk.red("✗ Project ID is required"));
    console.log(chalk.yellow("Usage: linguaflow push <project-id> [options]"));
    process.exit(1);
  }

  try {
    let translations: Record<string, Record<string, string>> = {};
    let deprecateList: string[] = [];

    // Load translations from file(s)
    if (options.pattern) {
      // Load multiple files matching pattern
      const files = await glob(options.pattern);
      console.log(chalk.blue(`📁 Found ${files.length} file(s) matching pattern`));
      
      for (const file of files) {
        const fileTranslations = await loadTranslationsFromFile(file);
        // Merge translations
        for (const [namespace, keys] of Object.entries(fileTranslations)) {
          if (!translations[namespace]) {
            translations[namespace] = {};
          }
          Object.assign(translations[namespace], keys);
        }
      }
    } else {
      // Load single file
      const filePath = options.file || "translations.json";
      translations = await loadTranslationsFromFile(filePath);
    }

    // Parse deprecate list if provided
    if (options.deprecate) {
      deprecateList = options.deprecate.split(",").map(s => s.trim());
    }

    console.log(chalk.blue(`📤 Pushing translations to project ${targetProjectId}...`));
    console.log(chalk.gray(`Namespaces: ${Object.keys(translations).join(", ")}`));
    if (deprecateList.length > 0) {
      console.log(chalk.gray(`Deprecating: ${deprecateList.join(", ")}`));
    }

    const result = await pushTranslations(targetProjectId, translations, {
      lang: options.lang,
      deprecate: deprecateList.length > 0 ? deprecateList : undefined,
    });

    console.log(chalk.green("✓ Push completed successfully!"));
    console.log(chalk.gray(`Keys created: ${result.keysCreated}`));
    console.log(chalk.gray(`Keys updated: ${result.keysUpdated}`));
    console.log(chalk.gray(`Translations created: ${result.translationsCreated}`));
    console.log(chalk.gray(`Translations updated: ${result.translationsUpdated}`));
    if (result.deprecated > 0) {
      console.log(chalk.gray(`Deprecated: ${result.deprecated}`));
    }
  } catch (error: any) {
    console.error(chalk.red("✗ Push failed:"), error.message);
    process.exit(1);
  }
}

