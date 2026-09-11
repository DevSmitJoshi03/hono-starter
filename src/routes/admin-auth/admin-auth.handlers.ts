import * as adminQueries from "@/db/queries/admin";
import * as refreshTokensQueries from "@/db/queries/refresh-tokens";
import * as usersQueries from "@/db/queries/user";
import { Platform } from "@/db/schema/refresh-tokens";
import { UserType } from "@/db/schema/user";
import type { AppRouteHandler } from "@/lib/types";
import { generateRefreshToken, hashToken } from "@/utility/crypto";
import { HttpStatusCodes } from "@/utility/http-status";
import { issueJWT } from "@/utility/jwt";
import { verifyPassword } from "@/utility/password";
import {
	issueRefreshToken,
	refreshTokenDeliveryMode,
} from "@/utility/refresh-token-delivery";
import { ErrorCodes, failure, success } from "@/utility/response";
import type { AdminLoginRoute } from "./admin-auth.routes";

export const login: AppRouteHandler<AdminLoginRoute> = async (c) => {
	const db = c.var.db;
	const { email, password } = c.req.valid("json");

	const user = await usersQueries.findOne({ email, type: UserType.ADMIN }, db);
	if (!user) {
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, "Invalid email or password"),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	const passwordValid = await verifyPassword(password, user.password);
	if (!passwordValid) {
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, "Invalid email or password"),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	const admin = await adminQueries.findOne({ userId: user.id }, db);
	if (!admin) {
		return c.json(
			failure(ErrorCodes.NOT_FOUND, "Admin profile not found"),
			HttpStatusCodes.NOT_FOUND
		);
	}

	const accessToken = await issueJWT(c, { id: user.id, type: UserType.ADMIN });
	const refreshToken = generateRefreshToken();

	const headers = c.req.valid("header");
	const userAgent = headers["user-agent"] ?? "Unknown";
	const ipAddress =
		c.req.header("CF-Connecting-IP") ??
		c.req.header("X-Forwarded-For") ??
		"Unknown";
	const deviceId = headers["x-device-id"] ?? "admin-web-browser";
	const platform = headers["x-platform"] ?? Platform.ADMIN_DASHBOARD;

	try {
		await db.transaction(async (tx) => {
			if (c.env.AUTH_MODE === "SINGLE") {
				await refreshTokensQueries.removeAll({ userId: user.id }, tx);
			}

			const inserted = await refreshTokensQueries.create(
				{
					userId: user.id,
					tokenHash: await hashToken(refreshToken),
					deviceId,
					userAgent,
					ipAddress,
					platform,
					expiresAt: new Date(Date.now() + c.env.REFRESH_TOKEN_TTL_MS),
				},
				tx
			);

			if (!inserted) {
				throw new Error("Failed to create refresh token");
			}
		});
	} catch (error) {
		c.var.logger.error({ err: error }, "Admin login failed");
		return c.json(
			failure(ErrorCodes.INTERNAL_ERROR, "Failed to process login"),
			HttpStatusCodes.INTERNAL_SERVER_ERROR
		);
	}

	const returnedRefreshToken = issueRefreshToken(
		c,
		refreshToken,
		platform,
		c.env.REFRESH_TOKEN_TTL_MS
	);

	return c.json(
		success({
			accessToken,
			refreshToken: returnedRefreshToken,
			refreshTokenDelivery: refreshTokenDeliveryMode(platform),
			admin: { ...admin, email: user.email },
		}),
		HttpStatusCodes.OK
	);
};
