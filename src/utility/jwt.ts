import type { Context } from "hono";
import { sign } from "hono/jwt";
import type { AppBindings } from "../lib/types";

/**
 * Normalizes a PKCS8 key by replacing literal \n strings with actual newlines.
 * This is necessary because Cloudflare Workers environment variables store multi-line
 * values with literal "\n" (two characters) instead of actual newline characters.
 *
 * @param key - The raw key string from environment variables
 * @returns Properly formatted key with actual newlines
 */
export function normalizeKey(key: string): string {
	// Replace literal \n with actual newlines
	return key.replace(/\\n/g, "\n");
}

export async function issueJWT(c: Context<AppBindings>, payload: object) {
	const privateKey = c.env.JWT_PRIVATE_KEY;
	if (!privateKey) throw new Error("Private key not found");

	// Normalize the private key to handle Cloudflare Workers environment
	const normalizedKey = normalizeKey(privateKey);

	return sign(
		{
			...payload,
			exp: Math.floor(Date.now() / 1000) + c.env.JWT_EXPIRES_IN,
		},
		normalizedKey,
		"EdDSA"
	);
}
