import { OpenAPIHono } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { except } from "hono/combine";
import { cors } from "hono/cors";
import { timeout } from "hono/timeout";
import { match } from "path-to-regexp";
import { createDb } from "@/db";
import { parseEnv } from "@/env";
import type { AppBindings, AppOpenAPI } from "@/lib/types";
import {
	globalRateLimit,
	jwtAuth,
	notFound,
	onError,
	rateLimit,
	requestId,
	serveEmojiFavicon,
} from "@/middlewares";
import { pinoLogger } from "@/middlewares/pino-logger";
import { securityMiddleware } from "@/middlewares/security";
import { defaultHook } from "@/openapi";

// Pre-compile matchers outside the middleware
const publicPathMatchers = [
	match("/", { decode: decodeURIComponent }),
	match("/health", { decode: decodeURIComponent }),
	match("/doc", { decode: decodeURIComponent }),
	match("/reference", { decode: decodeURIComponent }),
	match("/admin/login", { decode: decodeURIComponent }),
	match("/customer/auth/register", { decode: decodeURIComponent }),
	match("/customer/auth/login", { decode: decodeURIComponent }),
	match("/auth/logout", { decode: decodeURIComponent }),
	match("/auth/refresh", { decode: decodeURIComponent }),
	match("/auth/forgot-password", { decode: decodeURIComponent }),
	match("/auth/verify-otp", { decode: decodeURIComponent }),
	match("/auth/reset-password", { decode: decodeURIComponent }),
];

function isPublicPath(path: string): boolean {
	return publicPathMatchers.some((matcher) => matcher(path));
}

// The OpenAPI JSON (/doc) and the Scalar UI built on top of it (/reference)
// expose the full API surface — every route, request/response schema, and
// error shape. Closed in production; still public in dev/test for local
// exploration (see the isPublicPath allowlist above).
function isDocsPath(path: string): boolean {
	return path === "/doc" || path === "/reference";
}

// Global "*" middleware (this file) still runs for paths with no matching
// route, since Hono resolves the full middleware chain before routing falls
// through to app.notFound(). Without this check, jwtAuth() would reject
// unauthenticated requests to unknown paths with 401 before they ever reach
// the 404 handler. `matchedRoutes` reports every matched entry for the
// request; concrete endpoints have a real pattern, global middleware
// registered via app.use("*", ...) is normalized by Hono to the path "/*".
function hasMatchedRoute(c: { req: { matchedRoutes: { path: string }[] } }) {
	return c.req.matchedRoutes.some((route) => route.path !== "/*");
}

// Credential/OTP-guessing surface: routes reachable without a JWT where an
// attacker can brute-force a password, OTP, or account existence.
// "/auth/logout" and "/auth/refresh" are excluded — they act on a token the
// caller already holds, so there's no secret to brute-force there.
const rateLimitedPathMatchers = [
	match("/admin/login", { decode: decodeURIComponent }),
	match("/customer/auth/register", { decode: decodeURIComponent }),
	match("/customer/auth/login", { decode: decodeURIComponent }),
	match("/auth/forgot-password", { decode: decodeURIComponent }),
	match("/auth/verify-otp", { decode: decodeURIComponent }),
	match("/auth/reset-password", { decode: decodeURIComponent }),
];

function isRateLimitedPath(path: string): boolean {
	return rateLimitedPathMatchers.some((matcher) => matcher(path));
}

export function createRouter() {
	return new OpenAPIHono<AppBindings>({
		strict: false,
		defaultHook,
	});
}

export default function createApp() {
	const app = createRouter();

	// 0️⃣ Request id — assigned before logging so every log line and the
	// x-request-id response header share the same value.
	app.use("*", requestId);

	// 1️⃣ Environment parsing — runs before anything that reads c.env (CORS's
	// origin check included), so those middlewares always see validated env
	// rather than whatever the runtime handed in (or nothing at all, e.g. a
	// test harness that calls app.request() without an env).
	// process.env is merged first so .dev.vars (c.env) takes precedence.
	// This prevents the host's NODE_ENV=production from overriding the local dev flag.
	app.use((c, next) => {
		// biome-ignore lint/style/noProcessEnv: Accessing process.env is required here
		const validated = parseEnv(Object.assign({}, process.env, c.env));
		// Merge into a fresh object rather than mutating a possibly-undefined
		// c.env, so CF bindings (e.g. HYPERDRIVE) already present are kept.
		c.env = Object.assign(c.env ?? {}, validated);
		return next();
	});

	// 1a️⃣ Close /doc and /reference in production — same 404 body as any
	// unknown path, so probing them looks no different from probing garbage.
	app.use("*", async (c, next) => {
		if (isDocsPath(c.req.path) && c.env.NODE_ENV === "production") {
			return notFound(c);
		}
		return next();
	});

	// 2️⃣ Security headers first
	app.use("*", securityMiddleware);

	app.use(
		cors({
			origin: (origin, c) => {
				const origins = (c.env.CORS_ORIGIN ?? "")
					.split(",")
					.map((x: string) => x.trim());
				if (origins.includes("*")) return "*";
				return origins.includes(origin) ? origin : null;
			},
			credentials: true,
		})
	);

	// 3️⃣ Timeout middleware (25s)
	// - Protects Workers from long-running requests
	// - Cloudflare Workers CPU limit is 30s, so 25s is safe
	app.use("*", timeout(25000));

	// 3a️⃣ Body limit — runs before rate limiting and the DB client so an
	// oversized request is rejected on a cheap Content-Length/streamed-byte
	// check instead of first paying for a rate-limiter binding call and a
	// pooled DB connection it'll never use.
	app.use(
		"*",
		bodyLimit({
			maxSize: 5 * 1024 * 1024,
			onError: (c) => c.text("Request body too large", 413),
		})
	);

	// 3b️⃣ Rate limiting for login/OTP/password-reset endpoints — runs before
	// the DB client is created so a throttled request doesn't pay for a
	// connection it'll never use.
	app.use(
		"*",
		except((c) => !isRateLimitedPath(c.req.path), rateLimit())
	);

	// 3c️⃣ DB client — created per request; pool lifecycle managed per adapter
	app.use(async (c, next) => {
		const { db, client } = createDb(c.env);
		c.set("db", db);
		await next();
		// waitUntil: response is dispatched first; pool teardown runs in the background.
		// The try-catch handles non-Workers runtimes (e.g. Vitest) where executionCtx
		// is absent and Hono throws "This context has no ExecutionContext".
		try {
			c.executionCtx.waitUntil(client.end());
		} catch {
			void client.end();
		}
	});

	// 4️⃣ Logging
	app.use(pinoLogger());

	// 5️⃣ Favicon (optional)
	app.use(serveEmojiFavicon("🔥"));

	// 6️⃣ JWT auth for all except public paths
	// Also skip auth when nothing will actually match this path — otherwise
	// an unauthenticated request to a nonexistent route gets a 401 from
	// jwtAuth() instead of falling through to the 404 handler below.
	app.use(
		"*",
		except((c) => isPublicPath(c.req.path) || !hasMatchedRoute(c), jwtAuth())
	);

	// 6a️⃣ Broad rate limit on every route — runs after auth so it can key by
	// user id, bounding the damage from a single leaked access token.
	app.use("*", globalRateLimit());

	// 7️⃣ NotFound & Error handlers
	app.notFound(notFound);
	app.onError(onError);

	return app;
}

export function createTestApp<R extends AppOpenAPI>(router: R) {
	return createApp().route("/", router);
}
