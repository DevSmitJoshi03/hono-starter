/** biome-ignore-all lint/suspicious/noConsole: required for migrations */
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

// Load environment variables
expand(
	config({
		path: path.resolve(
			process.cwd(),
			// biome-ignore lint/style/noProcessEnv: Accessing process.env is required here
			process.env.NODE_ENV === "test" ? ".env.test" : ".env"
		),
	})
);

// biome-ignore lint/style/noProcessEnv: Accessing process.env is required here
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL environment variable is not set");
}

async function runMigrations() {
	console.log("Running migrations...");

	const sql = neon(databaseUrl as string);
	const db = drizzle(sql);

	await migrate(db, {
		migrationsFolder: "./src/db/migrations",
	});

	console.log("Migrations completed successfully!");
	process.exit(0);
}

runMigrations().catch((error) => {
	console.error("Migration failed:", error);
	process.exit(1);
});
