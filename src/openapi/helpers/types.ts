/** biome-ignore-all lint/suspicious/noExplicitAny: false positive */
import type { z } from "@hono/zod-openapi";

export type ZodSchema =
	| z.ZodType<any>
	| z.ZodUnion<any>
	| z.ZodObject<any>
	| z.ZodArray<any>;
export type ZodIssue = z.ZodIssue;
