import { z } from "@hono/zod-openapi";

export function createSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
	return z.object({
		success: z.literal(true),
		data: dataSchema,
	});
}
