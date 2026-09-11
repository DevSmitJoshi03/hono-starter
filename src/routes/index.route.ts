import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import { ping } from "@/db";
import { createRouter } from "@/lib/create-app";
import { jsonContent } from "@/openapi/helpers";
import { createMessageObjectSchema } from "@/openapi/schemas";
import { HttpStatusCodes } from "@/utility/http-status";

const router = createRouter()
	.openapi(
		createRoute({
			tags: ["Index"],
			method: "get",
			path: "/",
			responses: {
				[HttpStatusCodes.OK]: jsonContent(
					createMessageObjectSchema("Tasks API"),
					"Tasks API Index"
				),
			},
		}),
		(c) => {
			return c.json(
				{
					message: "Tasks API on Cloudflare",
				},
				HttpStatusCodes.OK
			);
		}
	)
	.openapi(
		createRoute({
			tags: ["Index"],
			method: "get",
			path: "/health",
			responses: {
				[HttpStatusCodes.OK]: jsonContent(
					z.object({ ok: z.boolean(), latency_ms: z.number() }),
					"Database reachability check"
				),
			},
		}),
		async (c) => {
			const db = c.var.db;
			const start = Date.now();
			await ping(db);
			return c.json(
				{ ok: true, latency_ms: Date.now() - start },
				HttpStatusCodes.OK
			);
		}
	);

export default router;
