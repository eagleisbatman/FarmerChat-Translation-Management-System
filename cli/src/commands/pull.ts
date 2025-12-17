import * as fs from "fs/promises";
import * as path from "path";
import { pullTranslations } from "../api";
import { getCurrentProject } from "../config";
import chalk from "chalk";

export async function pullCommand(
  projectId: string | undefined,
  options: { lang?: string; namespace?: string; output?: string }
): Promise<void> {
  const targetProjectId = projectId || getCurrentProject();
  
  if (!targetProjectId) {
    console.error(chalk.red("✗ Project ID is required"));
    console.log(chalk.yellow("Usage: linguaflow pull <project-id>"));
    console.log(chalk.yellow("Or set a default project: linguaflow project set <project-id>"));
    process.exit(1);
  }

  try {
    console.log(chalk.blue(`📥 Pulling translations from project ${targetProjectId}...`));
    
    const data = await pullTranslations(targetProjectId, {
      lang: options.lang,
      namespace: options.namespace,
    });

    const outputPath = options.output || "translations.json";
    
    // Write translations to file
    await fs.writeFile(
      outputPath,
      JSON.stringify(data.translations, null, 2),
      "utf-8"
    );

    console.log(chalk.green(`✓ Translations saved to ${outputPath}`));
    console.log(chalk.gray(`Project: ${data.project.name}`));
    console.log(chalk.gray(`Namespaces: ${Object.keys(data.translations).join(", ")}`));
  } catch (error: any) {
    console.error(chalk.red("✗ Pull failed:"), error.message);
    process.exit(1);
  }
}

