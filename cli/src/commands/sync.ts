import { pullCommand } from "./pull";
import { pushCommand } from "./push";
import chalk from "chalk";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Sync translations: pull from server, merge with local changes, push back
 */
export async function syncCommand(
  projectId: string | undefined,
  options: {
    lang?: string;
    namespace?: string;
    file?: string;
    deprecate?: string;
  }
): Promise<void> {
  const targetProjectId = projectId || getCurrentProject();
  
  if (!targetProjectId) {
    console.error(chalk.red("✗ Project ID is required"));
    process.exit(1);
  }

  try {
    console.log(chalk.blue("🔄 Syncing translations..."));
    console.log();

    // Step 1: Pull current translations
    console.log(chalk.yellow("Step 1: Pulling current translations..."));
    const tempFile = ".linguaflow-temp.json";
    
    await pullCommand(targetProjectId, {
      lang: options.lang,
      namespace: options.namespace,
      output: tempFile,
    });

    // Step 2: Merge with local file if it exists
    const localFile = options.file || "translations.json";
    let localTranslations: Record<string, Record<string, string>> = {};
    
    try {
      const localContent = await fs.readFile(localFile, "utf-8");
      localTranslations = JSON.parse(localContent);
      console.log(chalk.green(`✓ Loaded local translations from ${localFile}`));
    } catch {
      console.log(chalk.gray(`No local file found at ${localFile}, using server translations`));
    }

    // Load server translations
    const serverContent = await fs.readFile(tempFile, "utf-8");
    const serverTranslations: Record<string, Record<string, string>> = JSON.parse(serverContent);

    // Merge: local takes precedence
    const merged: Record<string, Record<string, string>> = { ...serverTranslations };
    for (const [namespace, keys] of Object.entries(localTranslations)) {
      if (!merged[namespace]) {
        merged[namespace] = {};
      }
      Object.assign(merged[namespace], keys);
    }

    // Step 3: Push merged translations
    console.log();
    console.log(chalk.yellow("Step 2: Pushing merged translations..."));
    
    // Temporarily override file option to use merged data
    await fs.writeFile(tempFile, JSON.stringify(merged, null, 2), "utf-8");
    
    await pushCommand(targetProjectId, {
      file: tempFile,
      lang: options.lang,
      deprecate: options.deprecate,
    });

    // Step 4: Update local file with merged data
    await fs.writeFile(localFile, JSON.stringify(merged, null, 2), "utf-8");
    console.log(chalk.green(`✓ Updated local file: ${localFile}`));

    // Cleanup
    await fs.unlink(tempFile).catch(() => {});

    console.log();
    console.log(chalk.green("✓ Sync completed successfully!"));
  } catch (error: any) {
    console.error(chalk.red("✗ Sync failed:"), error.message);
    process.exit(1);
  }
}

