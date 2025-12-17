import { verifyToken } from "../api";
import { getConfig, getCurrentProject } from "../config";
import chalk from "chalk";

export async function statusCommand(): Promise<void> {
  const config = getConfig();
  
  console.log(chalk.blue("📊 LinguaFlow CLI Status"));
  console.log();

  // Check authentication
  if (!config.token) {
    console.log(chalk.red("✗ Not authenticated"));
    console.log(chalk.yellow("Run 'linguaflow login' to authenticate"));
    return;
  }

  try {
    const result = await verifyToken();
    if (result.valid) {
      console.log(chalk.green("✓ Authenticated"));
      console.log(chalk.gray(`User: ${result.user.email}`));
      console.log(chalk.gray(`Role: ${result.user.role}`));
    } else {
      console.log(chalk.red("✗ Token invalid or expired"));
      console.log(chalk.yellow("Run 'linguaflow login' to re-authenticate"));
    }
  } catch (error: any) {
    console.log(chalk.red("✗ Authentication check failed"));
    console.log(chalk.gray(error.message));
    console.log(chalk.yellow("Run 'linguaflow login' to re-authenticate"));
  }

  console.log();
  console.log(chalk.blue("Configuration:"));
  console.log(chalk.gray(`API URL: ${config.apiUrl || "http://localhost:3000"}`));
  
  const currentProject = getCurrentProject();
  if (currentProject) {
    console.log(chalk.gray(`Current Project: ${currentProject}`));
  } else {
    console.log(chalk.yellow("No default project set"));
    console.log(chalk.gray("Set one with: linguaflow project set <project-id>"));
  }
}

