#!/usr/bin/env tsx
/**
 * Complete Environment Setup Script
 * Helps configure all required environment variables
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const ENV_FILE = path.join(process.cwd(), ".env");

interface EnvConfig {
  key: string;
  description: string;
  required: boolean;
  placeholder: string;
  currentValue?: string;
}

const REQUIRED_VARS: EnvConfig[] = [
  {
    key: "DATABASE_URL",
    description: "PostgreSQL connection string",
    required: true,
    placeholder: "postgresql://linguaflow:linguaflow_password@localhost:5432/farmerchat_tms",
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    description: "Google OAuth Client Secret (get from Google Cloud Console)",
    required: true,
    placeholder: "GOCSPX-your-client-secret-here",
  },
];

const OPTIONAL_VARS: EnvConfig[] = [
  {
    key: "OPENAI_API_KEY",
    description: "OpenAI API key for AI translation features",
    required: false,
    placeholder: "sk-your-openai-key-here",
  },
  {
    key: "GOOGLE_GEMINI_API_KEY",
    description: "Google Gemini API key (alternative AI provider)",
    required: false,
    placeholder: "your-gemini-key-here",
  },
  {
    key: "GOOGLE_TRANSLATE_API_KEY",
    description: "Google Translate API key",
    required: false,
    placeholder: "your-google-translate-key-here",
  },
];

function readEnvFile(): Map<string, string> {
  const envMap = new Map<string, string>();
  
  if (!fs.existsSync(ENV_FILE)) {
    return envMap;
  }

  const content = fs.readFileSync(ENV_FILE, "utf-8");
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      envMap.set(key, value);
    }
  }

  return envMap;
}

function writeEnvFile(envMap: Map<string, string>): void {
  const lines: string[] = [];
  
  // Read existing file to preserve comments and structure
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, "utf-8");
    const existingLines = content.split("\n");
    
    for (const line of existingLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          // Skip - we'll add it later
          continue;
        }
      }
      // Keep comments and empty lines
      if (trimmed.startsWith("#") || trimmed === "") {
        lines.push(line);
      }
    }
  }

  // Add all environment variables
  for (const [key, value] of envMap.entries()) {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(ENV_FILE, lines.join("\n") + "\n");
}

function isPlaceholder(value: string): boolean {
  const placeholders = [
    "your-",
    "YOUR_",
    "paste-",
    "generate-",
    "sk-your-",
    "GOCSPX-your-",
  ];
  return placeholders.some((p) => value.toLowerCase().includes(p.toLowerCase()));
}

async function promptForValue(config: EnvConfig, currentValue?: string): Promise<string | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const prompt = `\n${config.description}\n${config.key}${config.required ? " (REQUIRED)" : " (optional)"}${currentValue ? `\nCurrent: ${currentValue.substring(0, 20)}...` : ""}\nEnter value${config.required ? "" : " (press Enter to skip)"}: `;

    rl.question(prompt, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      
      if (!trimmed && !config.required) {
        resolve(null);
      } else if (!trimmed && config.required) {
        console.log(`⚠️  ${config.key} is required. Please provide a value.`);
        resolve(null);
      } else {
        resolve(trimmed);
      }
    });
  });
}

async function main() {
  console.log("🔧 LinguaFlow Environment Setup\n");
  console.log("=".repeat(60));

  const envMap = readEnvFile();
  const missing: EnvConfig[] = [];
  const needsUpdate: EnvConfig[] = [];

  // Check required variables
  console.log("\n📋 Checking Required Variables:\n");
  
  for (const config of REQUIRED_VARS) {
    const currentValue = envMap.get(config.key);
    
    if (!currentValue || isPlaceholder(currentValue)) {
      if (currentValue && isPlaceholder(currentValue)) {
        needsUpdate.push({ ...config, currentValue });
      } else {
        missing.push(config);
      }
      console.log(`  ✗ ${config.key}: Missing or placeholder`);
    } else {
      console.log(`  ✓ ${config.key}: Set`);
    }
  }

  // Check optional variables
  console.log("\n📋 Checking Optional Variables:\n");
  
  for (const config of OPTIONAL_VARS) {
    const currentValue = envMap.get(config.key);
    
    if (!currentValue || isPlaceholder(currentValue)) {
      if (currentValue && isPlaceholder(currentValue)) {
        needsUpdate.push({ ...config, currentValue });
      }
      console.log(`  ○ ${config.key}: Not set (optional)`);
    } else {
      console.log(`  ✓ ${config.key}: Set`);
    }
  }

  // Update missing/placeholder values
  if (missing.length > 0 || needsUpdate.length > 0) {
    console.log("\n" + "=".repeat(60));
    console.log("\n⚠️  Some variables need to be configured.\n");

    // Handle required variables first
    for (const config of [...missing, ...needsUpdate]) {
      const currentValue = envMap.get(config.key);
      const newValue = await promptForValue(config, currentValue);
      
      if (newValue) {
        envMap.set(config.key, newValue);
        console.log(`✓ Updated ${config.key}`);
      } else if (config.required) {
        console.log(`⚠️  Skipped ${config.key} (required - you'll need to set it manually)`);
      }
    }

    writeEnvFile(envMap);
    console.log("\n✓ Environment file updated!");
  } else {
    console.log("\n✅ All variables are configured!");
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n📝 Next Steps:");
  console.log("1. Review your .env file");
  console.log("2. Run: npm run db:migrate");
  console.log("3. Run: npm run db:seed");
  console.log("4. Run: npm run validate:oauth");
  console.log("5. Start app: npm run dev");
  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);

