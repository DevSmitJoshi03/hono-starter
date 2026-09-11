import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "@/lib/types";

const MAX_LEN = 128;
// Accept only a conservative token so a caller-supplied value can't inject
// headers or blow up log lines.
const VALID = /^[\w.-]+$/;

/**
 * Assigns every request a stable id, exposed as `c.var.requestId` (the pino
 * logger reuses it) and echoed back as the `x-request-id` response header so a
 * client or support can correlate a specific request with the logs.
 *
 * Honours an inbound `x-request-id` when it looks safe, otherwise generates one.
 * Must run before pinoLogger.
 */
const requestId: MiddlewareHandler<AppBindings> = async (c, next) => {
	const inbound = c.req.header("x-request-id");
	const id =
		inbound && inbound.length <= MAX_LEN && VALID.test(inbound)
			? inbound
			: randomUUID();

	c.set("requestId", id);
	await next();
	c.header("x-request-id", id);
};

export default requestId;
