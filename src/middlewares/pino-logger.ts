import { randomUUID } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "hono-pino";
import { pinoLogger as logger } from "hono-pino";
import pino from "pino";

import type { AppBindings } from "@/lib/types";

export function pinoLogger() {
	return (async (c, next) => {
		const isProduction = c.env.NODE_ENV === "production";

		// pino-pretty is a dev-only convenience — keep it off the production
		// startup path (it also pulls in Node-heavy deps).
		let transport: pino.DestinationStream | undefined;
		if (!isProduction) {
			const { default: pretty } = await import("pino-pretty");
			transport = pretty();
		}

		return logger({
			pino: pino({ level: c.env.LOG_LEVEL || "info" }, transport),
			http: {
				reqId: () => c.get("requestId") ?? randomUUID(),
			},
		})(c as unknown as Context<Env>, next);
	}) satisfies MiddlewareHandler<AppBindings>;
}
