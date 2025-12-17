import { clearConfig } from "../config";
import chalk from "chalk";

export function logoutCommand(): void {
  clearConfig();
  console.log(chalk.green("✓ Logged out successfully"));
}

