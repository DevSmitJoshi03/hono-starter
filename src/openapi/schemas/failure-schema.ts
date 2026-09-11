import { z } from "@hono/zod-openapi";

const FailureSchema = z.object({
	success: z.literal(false),
	code: z.string(),
	message: z.string(),
});

export default FailureSchema;
