require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { migrate } = require("drizzle-orm/postgres-js/migrator");
const postgres = require("postgres");
const { drizzle } = require("drizzle-orm/postgres-js");

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

