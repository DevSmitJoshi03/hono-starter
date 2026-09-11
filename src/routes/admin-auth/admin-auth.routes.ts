import { createRoute } from "@hono/zod-openapi";
import { jsonContent, jsonContentRequired } from "@/openapi/helpers";
import {
	createErrorSchema,
	createSuccessSchema,
	FailureSchema,
} from "@/openapi/schemas";
import { HttpStatusCodes } from "@/utility/http-status";
import {
	AdminLoginBodySchema,
	AdminLoginDataSchema,
	AdminLoginHeadersSchema,
} from "./admin-auth.type";

const tags = ["admin-auth"];

export const login = createRoute({
	path: "/admin/login",
	method: "post",
	tags,
	request: {
		body: jsonContentRequired(AdminLoginBodySchema, "Admin credentials"),
		headers: AdminLoginHeadersSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			createSuccessSchema(AdminLoginDataSchema),
			"Authentication tokens and admin profile"
		),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(
			FailureSchema,
			"Invalid credentials"
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			FailureSchema,
			"Admin profile not found"
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(AdminLoginBodySchema),
			"Validation error(s)"
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			FailureSchema,
			"Internal server error"
		),
	},
});

export type AdminLoginRoute = typeof login;
