import z from "zod";
import { Platform } from "@/db/schema/refresh-tokens";
import { UserType } from "@/db/schema/user";
import { ImageMetadata } from "@/utility/type";

const userTypeValues = Object.values(UserType) as [string, ...string[]];

// Web clients authenticate refresh/logout via this httpOnly cookie. It's
// optional at the schema level because native app clients send the token via
// the `x-refresh-token` header instead (see RefreshTokenHeadersSchema) — the
// handler accepts either and 401s only if neither is present.
export const RefreshTokenCookieSchema = z.object({
	refreshToken: z.string().min(1).optional().openapi({
		description: "Refresh token stored in an HTTP-only cookie (web clients).",
		example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
	}),
});
export type RefreshTokenCookieSchema = z.infer<typeof RefreshTokenCookieSchema>;

export const RefreshTokenHeadersSchema = z.object({
	"user-agent": z.string().optional().openapi({
		description: "User agent string from the client",
		example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
	}),
	"x-device-id": z.string().optional().openapi({
		description: "Unique device identifier",
		example: "web-browser",
	}),
	"x-platform": z.enum(Platform).optional().openapi({
		description: "Platform from which the request originates",
		example: "web",
	}),
	"x-refresh-token": z
		.string()
		.min(1)
		.optional()
		.openapi({
			description:
				"Refresh token for native app clients (ios/android/desktop) that " +
				"can't rely on a shared cookie jar — sent instead of the cookie.",
			example: "3f1c...",
		}),
});
export type RefreshTokenHeadersSchema = z.infer<
	typeof RefreshTokenHeadersSchema
>;

const AdminProfileSchema = z.object({
	id: z.uuid(),
	userId: z.uuid().nullable(),
	name: z.string(),
	email: z.string(),
	phoneNumber: z.string(),
	address: z.string(),
	isSuperAdmin: z.boolean(),
	permission: z.array(z.string()),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const CustomerProfileSchema = z.object({
	id: z.uuid(),
	userId: z.uuid().nullable(),
	name: z.string(),
	email: z.string(),
	phoneNumber: z.string(),
	image: ImageMetadata.nullable(),
	status: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const AccessTokenResponseSchema = z.object({
	accessToken: z.string(),
	// Present only when refreshTokenDelivery is "body" (native app clients) —
	// see src/utility/refresh-token-delivery.ts. Web clients get the rotated
	// token as an httpOnly cookie instead and this field is omitted.
	refreshToken: z.string().optional(),
	// Always present, even when refreshToken is omitted — tells the caller
	// which delivery mode it got, so a native client that forgot to send
	// x-platform sees "cookie" here instead of a silently missing token.
	refreshTokenDelivery: z.enum(["cookie", "body"]),
	type: z.enum(userTypeValues),
	data: z.union([AdminProfileSchema, CustomerProfileSchema]),
});
export type AccessTokenResponseSchema = z.infer<
	typeof AccessTokenResponseSchema
>;

export const ForgotPasswordBodySchema = z.object({
	email: z.string().email().openapi({ example: "user@example.com" }),
	type: z.enum(userTypeValues).openapi({
		example: UserType.CUSTOMER,
		description: "User type (admin | customer)",
	}),
});
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBodySchema>;

export const VerifyOtpBodySchema = z.object({
	email: z.string().email().openapi({ example: "user@example.com" }),
	type: z.enum(userTypeValues).openapi({
		example: UserType.CUSTOMER,
	}),
	otp: z.string().length(6).openapi({ example: "123456" }),
});
export type VerifyOtpBody = z.infer<typeof VerifyOtpBodySchema>;

export const ResetPasswordBodySchema = z.object({
	email: z.string().email().openapi({ example: "user@example.com" }),
	type: z.enum(userTypeValues).openapi({
		example: UserType.CUSTOMER,
	}),
	otp: z.string().length(6).openapi({ example: "123456" }),
	newPassword: z.string().min(8).openapi({ example: "newpassword123" }),
});
export type ResetPasswordBody = z.infer<typeof ResetPasswordBodySchema>;
