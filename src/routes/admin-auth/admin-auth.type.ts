import z from "zod";
import { Platform } from "@/db/schema/refresh-tokens";

export const AdminLoginBodySchema = z.object({
	email: z.string().email().openapi({ example: "admin@example.com" }),
	password: z.string().min(8).openapi({ example: "password123" }),
});

export const AdminLoginDataSchema = z.object({
	accessToken: z.string(),
	// Present only when refreshTokenDelivery is "body" (native app clients);
	// web clients get the refresh token as an httpOnly cookie instead.
	refreshToken: z.string().optional(),
	// Always present — see src/utility/refresh-token-delivery.ts. Lets a
	// client that forgot to send x-platform notice it got "cookie" delivery
	// instead of silently missing the token.
	refreshTokenDelivery: z.enum(["cookie", "body"]),
	admin: z.object({
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
	}),
});

export const AdminLoginHeadersSchema = z.object({
	"user-agent": z.string().optional().openapi({
		description: "User agent string from the client",
		example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
	}),
	"x-device-id": z.string().optional().openapi({
		description: "Unique device identifier",
		example: "admin-web-browser",
	}),
	"x-platform": z.enum(Platform).optional().openapi({
		description: "Platform from which the request originates",
		example: "admin-dashboard",
	}),
});

export type AdminLoginBody = z.infer<typeof AdminLoginBodySchema>;
export type AdminLoginData = z.infer<typeof AdminLoginDataSchema>;
export type AdminLoginHeaders = z.infer<typeof AdminLoginHeadersSchema>;
