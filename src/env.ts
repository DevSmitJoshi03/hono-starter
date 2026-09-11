import path from "node:path";
import type {
	Hyperdrive,
	R2Bucket,
	RateLimit,
	SendEmail,
} from "@cloudflare/workers-types";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

expand(
	config({
		path: path.resolve(
			process.cwd(),
			// biome-ignore lint/style/noProcessEnv: Accessing process.env is required here
			process.env.NODE_ENV === "test" ? ".env.test" : ".env"
		),
	})
);

const EnvSchema = z.object({
	NODE_ENV: z.string().default("development"),
	PORT: z.coerce.number().default(9999),
	LOG_LEVEL: z.enum([
		"fatal",
		"error",
		"warn",
		"info",
		"debug",
		"trace",
		"silent",
	]),
	// Required locally; absent in production where HYPERDRIVE binding is used instead.
	DATABASE_URL: z.string().optional(),
	REFRESH_TOKEN_TTL_MS: z.coerce.number().default(604800000),
	AUTH_MODE: z.enum(["SINGLE", "MULTI"]).default("SINGLE"),
	JWT_PRIVATE_KEY: z.string(),
	JWT_PUBLIC_KEY: z.string(),
	JWT_EXPIRES_IN: z.coerce.number().default(900),
	OTP_EXPIRES_IN_MS: z.coerce.number().default(600000),
	HYPERDRIVE: z.custom<Hyperdrive>().optional(),
	EMAIL: z.custom<SendEmail>().optional(),
	R2_BUCKET: z.custom<R2Bucket>().optional(),
	AUTH_RATE_LIMITER: z.custom<RateLimit>().optional(),
	API_RATE_LIMITER: z.custom<RateLimit>().optional(),
	R2_BUCKET_NAME: z.string(),
	R2_ACCESS_KEY_ID: z.string(),
	R2_SECRET_ACCESS_KEY: z.string(),
	CLOUDFLARE_ACCOUNT_ID: z.string(),
	CORS_ORIGIN: z.string().optional(),
	// Email branding — used by src/utility/email.ts / email-templates.ts.
	// Change these values, not the source, to rebrand outgoing emails.
	BRAND_NAME: z.string().default("Your App"),
	EMAIL_FROM_ADDRESS: z.string().default("noreply@example.com"),
	// Public site the email footer/CTA links point at (privacy, terms, "go to
	// app" button). No trailing slash.
	SITE_URL: z.string().default("https://example.com"),
	// Optional logo image shown in the email header. Leave unset to fall back
	// to a text wordmark (BRAND_NAME) instead of an <img>.
	LOGO_URL: z.string().optional(),
	// Hex color used for the OTP box border, links, and the header accent rule.
	BRAND_ACCENT_COLOR: z.string().default("#2563eb"),
});

export type Environment = z.infer<typeof EnvSchema>;

export function parseEnv(data: unknown) {
	const result = EnvSchema.safeParse(data);

	if (!result.success) {
		// Format errors for better debugging
		const errorMessage = result.error.issues
			.map((err) => `${err.path.join(".")}: ${err.message}`)
			.join(" | ");

		throw new Error(`❌ Invalid env - errors: ${errorMessage}`);
	}

	return result.data;
}
