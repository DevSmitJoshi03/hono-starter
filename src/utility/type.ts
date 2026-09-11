import z from "zod";

export const ImageMetadata = z.object({
	id: z.string().nonempty(),
	url: z.string(),
	name: z.string().nonempty(),
});
export type ImageMetadata = z.infer<typeof ImageMetadata>;
