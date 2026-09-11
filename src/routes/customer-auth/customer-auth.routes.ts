import { createRoute, z } from "@hono/zod-openapi";
import { selectCustomersSchema } from "@/db/schema/customer";
import { UserType } from "@/db/schema/user";
import { requireRole } from "@/middlewares/auth";
import {
	formContentRequired,
	jsonContent,
	jsonContentRequired,
} from "@/openapi/helpers";
import {
	createErrorSchema,
	createSuccessSchema,
	FailureSchema,
} from "@/openapi/schemas";
import { HttpStatusCodes } from "@/utility/http-status";
import {
	ChangePasswordBodySchema,
	CustomerAuthDataSchema,
	CustomerAuthHeadersSchema,
	CustomerLoginBodySchema,
	CustomerRegisterBodySchema,
	UpdateProfileBodySchema,
} from "./customer-auth.type";

const tags = ["customer-auth"];

export const register = createRoute({
	path: "/customer/auth/register",
	method: "post",
	tags,
	request: {
		body: jsonContentRequired(
			CustomerRegisterBodySchema,
			"Customer registration details"
		),
		headers: CustomerAuthHeadersSchema,
	},
	responses: {
		[HttpStatusCodes.CREATED]: jsonContent(
			createSuccessSchema(CustomerAuthDataSchema),
			"Registration successful"
		),
		[HttpStatusCodes.CONFLICT]: jsonContent(
			FailureSchema,
			"Email already registered"
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(CustomerRegisterBodySchema),
			"Validation error(s)"
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			FailureSchema,
			"Internal server error"
		),
	},
});

export const login = createRoute({
	path: "/customer/auth/login",
	method: "post",
	tags,
	request: {
		body: jsonContentRequired(CustomerLoginBodySchema, "Customer credentials"),
		headers: CustomerAuthHeadersSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			createSuccessSchema(CustomerAuthDataSchema),
			"Login successful"
		),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(
			FailureSchema,
			"Invalid credentials"
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			FailureSchema,
			"Customer profile not found"
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(CustomerLoginBodySchema),
			"Validation error(s)"
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			FailureSchema,
			"Internal server error"
		),
	},
});

export const me = createRoute({
	path: "/customer/auth/me",
	method: "get",
	tags,
	middleware: [requireRole(UserType.CUSTOMER)],
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			createSuccessSchema(selectCustomersSchema),
			"Customer profile"
		),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(FailureSchema, "Unauthorized"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			FailureSchema,
			"Customer profile not found"
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			FailureSchema,
			"Internal server error"
		),
	},
});

export const updateProfile = createRoute({
	path: "/customer/auth/profile",
	method: "patch",
	tags,
	middleware: [requireRole(UserType.CUSTOMER)],
	request: {
		body: formContentRequired(
			UpdateProfileBodySchema,
			"Profile fields to update"
		),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			createSuccessSchema(selectCustomersSchema),
			"Updated customer profile"
		),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(FailureSchema, "Unauthorized"),
		[HttpStatusCodes.CONFLICT]: jsonContent(
			FailureSchema,
			"Email already in use"
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			FailureSchema,
			"Customer profile not found"
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(UpdateProfileBodySchema),
			"Validation error(s)"
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			FailureSchema,
			"Internal server error"
		),
	},
});

export const changePassword = createRoute({
	path: "/customer/auth/change-password",
	method: "patch",
	tags,
	middleware: [requireRole(UserType.CUSTOMER)],
	request: {
		body: jsonContentRequired(
			ChangePasswordBodySchema,
			"Current and new password"
		),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			createSuccessSchema(z.object({ message: z.string() })),
			"Password changed successfully"
		),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(
			FailureSchema,
			"Unauthorized or incorrect current password"
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(ChangePasswordBodySchema),
			"Validation error(s)"
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			FailureSchema,
			"Internal server error"
		),
	},
});

export type CustomerRegisterRoute = typeof register;
export type CustomerLoginRoute = typeof login;
export type CustomerMeRoute = typeof me;
export type UpdateProfileRoute = typeof updateProfile;
export type ChangePasswordRoute = typeof changePassword;
