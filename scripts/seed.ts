import { db } from "../lib/db";
import { languages } from "../lib/db/schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const commonLanguages = [
  { code: "en", name: "English", flagEmoji: "🇺🇸" },
  { code: "es", name: "Spanish", flagEmoji: "🇪🇸" },
  { code: "fr", name: "French", flagEmoji: "🇫🇷" },
  { code: "de", name: "German", flagEmoji: "🇩🇪" },
  { code: "it", name: "Italian", flagEmoji: "🇮🇹" },
  { code: "pt", name: "Portuguese", flagEmoji: "🇵🇹" },
  { code: "ru", name: "Russian", flagEmoji: "🇷🇺" },
  { code: "ja", name: "Japanese", flagEmoji: "🇯🇵" },
  { code: "ko", name: "Korean", flagEmoji: "🇰🇷" },
  { code: "zh", name: "Chinese", flagEmoji: "🇨🇳" },
  { code: "hi", name: "Hindi", flagEmoji: "🇮🇳" },
  { code: "ar", name: "Arabic", flagEmoji: "🇸🇦" },
];

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    for (const lang of commonLanguages) {
      await db
        .insert(languages)
        .values({
          id: lang.code,
          code: lang.code,
          name: lang.name,
          flagEmoji: lang.flagEmoji,
        })
        .onConflictDoNothing();
    }

    console.log("✅ Seeding completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();

