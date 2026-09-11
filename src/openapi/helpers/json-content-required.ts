import jsonContent from "@/openapi/helpers/json-content.js";
import type { ZodSchema } from "@/openapi/helpers/types.ts";

const jsonContentRequired = <T extends ZodSchema>(
	schema: T,
	description: string
) => {
	return {
		...jsonContent(schema, description),
		required: true,
	};
};

export default jsonContentRequired;
