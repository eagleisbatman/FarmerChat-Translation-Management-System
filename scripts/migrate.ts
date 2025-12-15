import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🔄 Running database migrations...");

  try {
    const client = postgres(databaseUrl, { max: 1 });
    const db = drizzle(client);

    await migrate(db, { migrationsFolder: "./drizzle" });

    console.log("✅ Migrations completed successfully");
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();

