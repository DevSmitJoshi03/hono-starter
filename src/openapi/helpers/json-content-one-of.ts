import oneOf from "@/openapi/helpers/one-of.js";
import type { ZodSchema } from "@/openapi/helpers/types.ts";

const jsonContentOneOf = <T extends ZodSchema>(
	schemas: T[],
	description: string
) => {
	return {
		content: {
			"application/json": {
				schema: {
					oneOf: oneOf(schemas),
				},
			},
		},
		description,
	};
};

export default jsonContentOneOf;
