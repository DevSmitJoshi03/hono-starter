import path from "node:path";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { defineConfig } from "drizzle-kit";

expand(
	config({
		path: path.resolve(
			process.cwd(),
			// biome-ignore lint/style/noProcessEnv: Accessing process.env is required here
			process.env.NODE_ENV === "test" ? ".env.test" : ".env"
		),
	})
);

// Read DATABASE_URL directly rather than going through src/env-runtime.ts —
// that validates the *entire* app env schema (JWT keys, R2 creds, Cloudflare
// account id, ...), none of which drizzle-kit needs. Requiring all of it here
// would block `db:generate`/`db:migrate` on unrelated config.
// biome-ignore lint/style/noProcessEnv: Accessing process.env is required here
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL must be set to run drizzle-kit migrations");
}

export default defineConfig({
	schema: "./src/db/schema/index.ts",
	out: "./src/db/migrations",
	dialect: "postgresql",
	casing: "snake_case",
	dbCredentials: {
		url: databaseUrl,
	},
	verbose: true,
	strict: true,
});
