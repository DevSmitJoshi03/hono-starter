import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { AppBindings } from "@/lib/types";
import {
	INTERNAL_SERVER_ERROR,
	OK,
} from "@/utility/http-status/http-status-codes.js";

const onError: ErrorHandler<AppBindings> = (err, c) => {
	const currentStatus =
		"status" in err ? err.status : c.newResponse(null).status;
	const statusCode =
		currentStatus !== OK
			? (currentStatus as ContentfulStatusCode)
			: INTERNAL_SERVER_ERROR;
	// biome-ignore lint/style/noProcessEnv: required
	const env = c.env?.NODE_ENV || process.env?.NODE_ENV;
	const isProduction = env === "production";
	const isServerError = statusCode >= INTERNAL_SERVER_ERROR;

	// Always log the real error so it's recoverable from Workers logs.
	c.var.logger?.error(
		{ err, status: statusCode },
		"Unhandled error in request pipeline"
	);

	// 5xx messages frequently carry internals (driver text, stack context).
	// In production, return a generic message for those; 4xx messages are
	// author-controlled and safe to surface.
	const message =
		isProduction && isServerError ? "Internal server error" : err.message;

	// Echo the request id so a caller can quote it when reporting the failure.
	const requestId = c.get("requestId");
	if (requestId) c.header("x-request-id", requestId);

	return c.json(
		{
			message,
			stack: isProduction ? undefined : err.stack,
		},
		statusCode
	);
};

export default onError;
