import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "@/lib/types";
import { HttpStatusCodes, HttpStatusPhrases } from "@/utility/http-status";

function clientIp(c: {
	req: { header: (name: string) => string | undefined };
}) {
	return (
		c.req.header("CF-Connecting-IP") ??
		c.req.header("x-forwarded-for") ??
		"unknown"
	);
}

/**
 * Rate-limits by client IP + path, using the AUTH_RATE_LIMITER Cloudflare
 * binding (see wrangler.jsonc). Each (ip, path) pair gets its own bucket so
 * one endpoint under attack doesn't lock legitimate users out of others.
 *
 * The binding is only available on Cloudflare Workers, so this no-ops on
 * other runtimes (e.g. local Node via src/index.ts, Vitest).
 */
export const rateLimit = (): MiddlewareHandler<AppBindings> => {
	return async (c, next) => {
		const limiter = c.env.AUTH_RATE_LIMITER;
		if (!limiter) {
			await next();
			return;
		}

		const { success } = await limiter.limit({
			key: `${clientIp(c)}:${c.req.path}`,
		});

		if (!success) {
			return c.json(
				{ message: HttpStatusPhrases.TOO_MANY_REQUESTS },
				HttpStatusCodes.TOO_MANY_REQUESTS
			);
		}

		await next();
	};
};

/**
 * Broad limiter applied to every route via the API_RATE_LIMITER binding.
 * Keyed by authenticated user id when available (so one bad client is
 * throttled across all their devices), falling back to client IP for
 * anonymous traffic. No-ops when the binding is absent (non-Workers runtimes).
 */
export const globalRateLimit = (): MiddlewareHandler<AppBindings> => {
	return async (c, next) => {
		const limiter = c.env.API_RATE_LIMITER;
		if (!limiter) {
			await next();
			return;
		}

		const user = c.get("user");
		const key = user ? `user:${user.id}` : `ip:${clientIp(c)}`;
		const { success } = await limiter.limit({ key });

		if (!success) {
			return c.json(
				{ message: HttpStatusPhrases.TOO_MANY_REQUESTS },
				HttpStatusCodes.TOO_MANY_REQUESTS
			);
		}

		await next();
	};
};
