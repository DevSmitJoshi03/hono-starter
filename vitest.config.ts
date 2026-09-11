import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		// Dummy values for required env vars (src/env.ts) so tests that exercise
		// the full app (app.request(...) through the env-parsing middleware) run
		// without needing a real .env.test. None of these are real credentials —
		// nothing in the test suite actually signs/verifies a JWT or hits R2/S3.
		env: {
			LOG_LEVEL: "silent",
			JWT_PRIVATE_KEY: "test-private-key",
			JWT_PUBLIC_KEY: "test-public-key",
			R2_BUCKET_NAME: "test-bucket",
			R2_ACCESS_KEY_ID: "test-access-key-id",
			R2_SECRET_ACCESS_KEY: "test-secret-access-key",
			CLOUDFLARE_ACCOUNT_ID: "test-account-id",
			DATABASE_URL: "postgres://test:test@localhost:5432/test",
		},
	},
});
