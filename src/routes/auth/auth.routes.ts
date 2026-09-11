import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent, jsonContentRequired } from "@/openapi/helpers";
import {
	createErrorSchema,
	createSuccessSchema,
	FailureSchema,
} from "@/openapi/schemas";
import { HttpStatusCodes } from "@/utility/http-status";
import {
	AccessTokenResponseSchema,
	ForgotPasswordBodySchema,
	RefreshTokenCookieSchema,
	RefreshTokenHeadersSchema,
	ResetPasswordBodySchema,
	VerifyOtpBodySchema,
} from "./auth.type";

const tags = ["auth"];

export const refreshToken = createRoute({
	path: "/auth/refresh",
	method: "post",
	tags,
	request: {
		cookies: RefreshTokenCookieSchema,
		headers: RefreshTokenHeadersSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			createSuccessSchema(AccessTokenResponseSchema),
			"New access token"
		),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(
			FailureSchema,
			"Invalid or expired refresh token"
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			FailureSchema,
			"Refresh token not found"
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			FailureSchema,
			"Internal server error"
		),
	},
});

export const logout = createRoute({
	path: "/auth/logout",
	method: "post",
	tags,
	request: {
		cookies: RefreshTokenCookieSchema,
		headers: RefreshTokenHeadersSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			createSuccessSchema(z.null()),
			"Logout successful"
		),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(
			FailureSchema,
			"Invalid refresh token"
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			FailureSchema,
			"Refresh token not found"
		),
	},
});

export const forgotPassword = createRoute({
	path: "/auth/forgot-password",
	method: "post",
	tags,
	request: {
		body: jsonContentRequired(ForgotPasswordBodySchema, "Email to send OTP to"),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			createSuccessSchema(z.null()),
			"Reset code sent if the account exists"
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(ForgotPasswordBodySchema),
			"Validation error(s)"
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			FailureSchema,
			"Internal server error"
		),
	},
});

export const verifyOtp = createRoute({
	path: "/auth/verify-otp",
	method: "post",
	tags,
	request: {
		body: jsonContentRequired(VerifyOtpBodySchema, "Email and OTP to verify"),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			createSuccessSchema(z.null()),
			"OTP verified successfully"
		),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(
			FailureSchema,
			"Invalid or expired code, or too many attempts"
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(VerifyOtpBodySchema),
			"Validation error(s)"
		),
	},
});

export const resetPassword = createRoute({
	path: "/auth/reset-password",
	method: "post",
	tags,
	request: {
		body: jsonContentRequired(
			ResetPasswordBodySchema,
			"Email, OTP and new password"
		),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			createSuccessSchema(z.null()),
			"Password reset successfully"
		),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(
			FailureSchema,
			"Invalid or expired code, or too many attempts"
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(ResetPasswordBodySchema),
			"Validation error(s)"
		),
		[HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
			FailureSchema,
			"Internal server error"
		),
	},
});

export type RefreshTokenRoute = typeof refreshToken;
export type LogoutRoute = typeof logout;
export type ForgotPasswordRoute = typeof forgotPassword;
export type VerifyOtpRoute = typeof verifyOtp;
export type ResetPasswordRoute = typeof resetPassword;
