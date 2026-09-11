import z from "zod";
import { Platform } from "@/db/schema/refresh-tokens";
import { ImageMetadata } from "@/utility/type";

export const CustomerRegisterBodySchema = z.object({
	email: z.string().email().openapi({ example: "customer@example.com" }),
	password: z.string().min(8).openapi({ example: "password123" }),
	name: z.string().min(1).openapi({ example: "Jane Doe" }),
	phoneNumber: z.string().min(10).openapi({ example: "+919876543210" }),
});

export const CustomerLoginBodySchema = z.object({
	email: z.string().email().openapi({ example: "customer@example.com" }),
	password: z.string().min(8).openapi({ example: "password123" }),
});

export const CustomerAuthDataSchema = z.object({
	accessToken: z.string(),
	// Present only when refreshTokenDelivery is "body" (native app clients);
	// web clients get the refresh token as an httpOnly cookie instead. See
	// src/utility/refresh-token-delivery.ts.
	refreshToken: z.string().optional(),
	// Always present — lets a client that forgot to send x-platform notice it
	// got "cookie" delivery instead of silently missing the token.
	refreshTokenDelivery: z.enum(["cookie", "body"]),
	customer: z.object({
		id: z.uuid(),
		userId: z.uuid().nullable(),
		name: z.string(),
		email: z.string(),
		phoneNumber: z.string(),
		image: ImageMetadata.nullable(),
		status: z.boolean(),
		createdAt: z.date(),
		updatedAt: z.date(),
	}),
});

export const CustomerAuthHeadersSchema = z.object({
	"user-agent": z.string().optional().openapi({
		description: "User agent string from the client",
		example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
	}),
	"x-device-id": z.string().optional().openapi({
		description: "Unique device identifier",
		example: "web-browser",
	}),
	"x-platform": z
		.enum(Platform)
		.optional()
		.openapi({
			description:
				"Platform the request originates from. Determines refresh-token " +
				"delivery: web/admin-dashboard get an httpOnly cookie only; " +
				"ios/android/desktop also get it in the response body.",
			example: "web",
		}),
});

export const UpdateProfileBodySchema = z
	.object({
		email: z.string().email().openapi({ example: "jane@example.com" }),
		name: z.string().min(1).openapi({ example: "Jane Doe" }),
		phoneNumber: z.string().min(10).openapi({ example: "+919876543210" }),
		image: z
			.custom<File>((val) => val instanceof File)
			.optional()
			.openapi({
				type: "string",
				format: "binary",
				description: "Profile picture",
			}),
	})
	.partial()
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided",
	});

export const ChangePasswordBodySchema = z.object({
	currentPassword: z.string().min(8).openapi({ example: "oldPassword123" }),
	newPassword: z.string().min(8).openapi({ example: "newPassword456" }),
});

export type CustomerRegisterBody = z.infer<typeof CustomerRegisterBodySchema>;
export type CustomerLoginBody = z.infer<typeof CustomerLoginBodySchema>;
export type CustomerAuthData = z.infer<typeof CustomerAuthDataSchema>;
export type CustomerAuthHeaders = z.infer<typeof CustomerAuthHeadersSchema>;
export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>;
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>;
