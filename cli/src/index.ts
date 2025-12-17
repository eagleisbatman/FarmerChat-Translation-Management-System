#!/usr/bin/env node

// LinguaFlow CLI - Seamless Translation Management

import { Command } from "commander";
import { loginCommand } from "./commands/login";
import { logoutCommand } from "./commands/logout";
import { initCommand } from "./commands/init";
import { pullCommand } from "./commands/pull";
import { pushCommand } from "./commands/push";
import { syncCommand } from "./commands/sync";
import { statusCommand } from "./commands/status";
import { setCurrentProject, getCurrentProject } from "./config";
import chalk from "chalk";

const program = new Command();

program
  .name("linguaflow")
  .description("LinguaFlow CLI - Seamless Translation Management")
  .version("0.1.0");

program
  .command("login")
  .description("Authenticate with LinguaFlow")
  .action(loginCommand);

program
  .command("logout")
  .description("Log out from LinguaFlow")
  .action(logoutCommand);

program
  .command("init")
  .description("Initialize LinguaFlow configuration file")
  .action(() => {
    initCommand().catch((error) => {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    });
  });

program
  .command("status")
  .description("Show authentication status and configuration")
  .action(statusCommand);

program
  .command("pull [project-id]")
  .description("Pull translations from the server")
  .option("-l, --lang <lang>", "Language code (e.g., en, es)")
  .option("-n, --namespace <namespace>", "Namespace filter")
  .option("-o, --output <file>", "Output file (default: translations.json)")
  .action((projectId, options) => {
    pullCommand(projectId, options).catch((error) => {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    });
  });

program
  .command("push [project-id]")
  .description("Push translations to the server")
  .option("-f, --file <file>", "Translation file (default: translations.json)")
  .option("-l, --lang <lang>", "Language code")
  .option("-d, --deprecate <keys>", "Comma-separated list of keys to deprecate")
  .option("-p, --pattern <pattern>", "Glob pattern to match multiple files")
  .action((projectId, options) => {
    pushCommand(projectId, options).catch((error) => {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    });
  });

program
  .command("sync [project-id]")
  .description("Sync translations: pull, merge, and push")
  .option("-f, --file <file>", "Local translation file (default: translations.json)")
  .option("-l, --lang <lang>", "Language code")
  .option("-n, --namespace <namespace>", "Namespace filter")
  .option("-d, --deprecate <keys>", "Comma-separated list of keys to deprecate")
  .action((projectId, options) => {
    syncCommand(projectId, options).catch((error) => {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    });
  });

const projectCmd = program
  .command("project")
  .description("Manage default project");

projectCmd
  .command("set <project-id>")
  .description("Set default project ID")
  .action((projectId: string) => {
    setCurrentProject(projectId);
    console.log(chalk.green(`✓ Default project set to: ${projectId}`));
  });

projectCmd
  .command("get")
  .description("Get current default project")
  .action(() => {
    const projectId = getCurrentProject();
    if (projectId) {
      console.log(chalk.blue(`Current project: ${projectId}`));
    } else {
      console.log(chalk.yellow("No default project set"));
    }
  });

program.parse(process.argv);

