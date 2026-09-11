import type { ZodSchema } from "@/openapi/helpers/types.ts";

const formContentRequired = <T extends ZodSchema>(
	schema: T,
	description: string
) => {
	return {
		content: {
			"multipart/form-data": {
				schema,
			},
		},
		description,
		required: true,
	};
};

export default formContentRequired;
