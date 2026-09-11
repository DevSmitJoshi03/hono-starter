import type { NotFoundHandler } from "hono";
import { HttpStatusCodes, HttpStatusPhrases } from "@/utility/http-status";

const notFound: NotFoundHandler = (c) => {
	return c.json(
		{
			message: `${HttpStatusPhrases.NOT_FOUND} - ${c.req.path}`,
		},
		HttpStatusCodes.NOT_FOUND
	);
};

export default notFound;
