import * as fs from "fs/promises";
import * as path from "path";
import chalk from "chalk";
import inquirer from "inquirer";

interface ConfigFile {
  apiKey?: string;
  projectId?: string;
  baseUrl?: string;
  outputDir?: string;
  format?: string;
  languages?: string[];
}

export async function initCommand() {
  console.log(chalk.blue("🚀 Initializing LinguaFlow configuration...\n"));

  const configPath = path.join(process.cwd(), "linguaflow.config.json");
  const rcPath = path.join(process.cwd(), ".linguaflowrc");

  // Check if config already exists
  try {
    await fs.access(configPath);
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "Configuration file already exists. Overwrite?",
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.yellow("Cancelled. Configuration file not modified."));
      return;
    }
  } catch {
    // File doesn't exist, continue
  }

  try {
    await fs.access(rcPath);
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: ".linguaflowrc file already exists. Overwrite?",
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.yellow("Cancelled. Configuration file not modified."));
      return;
    }
  } catch {
    // File doesn't exist, continue
  }

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "baseUrl",
      message: "LinguaFlow API URL:",
      default: process.env.LINGUAFLOW_API_URL || "https://your-tms.com",
    },
    {
      type: "input",
      name: "apiKey",
      message: "API Key (optional, can be set later):",
      default: "",
    },
    {
      type: "input",
      name: "projectId",
      message: "Project ID (optional, can be set later):",
      default: "",
    },
    {
      type: "input",
      name: "outputDir",
      message: "Output directory for translations:",
      default: "./locales",
    },
    {
      type: "list",
      name: "format",
      message: "Default file format:",
      choices: ["json", "csv", "xliff"],
      default: "json",
    },
    {
      type: "input",
      name: "languages",
      message: "Languages (comma-separated, e.g., en,es,fr):",
      default: "en",
      filter: (input: string) => {
        return input.split(",").map((lang) => lang.trim()).filter(Boolean);
      },
    },
  ]);

  const config: ConfigFile = {
    baseUrl: answers.baseUrl,
    outputDir: answers.outputDir,
    format: answers.format,
    languages: answers.languages,
  };

  if (answers.apiKey) {
    config.apiKey = answers.apiKey;
  }

  if (answers.projectId) {
    config.projectId = answers.projectId;
  }

  // Write config file
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

  console.log(chalk.green(`\n✓ Configuration file created: ${configPath}`));
  console.log(chalk.blue("\nNext steps:"));
  console.log(chalk.gray("  1. Run 'linguaflow login' to authenticate"));
  console.log(chalk.gray("  2. Run 'linguaflow pull' to download translations"));
  console.log(chalk.gray("  3. Run 'linguaflow push' to upload translations"));
}

