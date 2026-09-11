import type { MiddlewareHandler } from "hono";
import { verify } from "hono/jwt";
import {
	JwtTokenExpired,
	JwtTokenInvalid,
	JwtTokenSignatureMismatched,
} from "hono/utils/jwt/types";
import * as adminQueries from "@/db/queries/admin";
import { UserType } from "@/db/schema/user";
import type { AppBindings } from "@/lib/types";
import { HttpStatusCodes } from "@/utility/http-status";
import { normalizeKey } from "@/utility/jwt";

export const AdminModule = {
	DASHBOARD: "dashboard",
	STAFF_MANAGEMENT: "staff_management",
} as const;

export type AdminModule = (typeof AdminModule)[keyof typeof AdminModule];

export const jwtAuth = (): MiddlewareHandler<AppBindings> => {
	return async (c, next) => {
		const authHeader = c.req.header("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return c.json(
				{ message: "Unauthorized - Invalid or missing token" },
				HttpStatusCodes.UNAUTHORIZED
			);
		}
		const token = authHeader.substring(7); // Remove "Bearer " prefix

		// Verify only wraps the JWT check — next() must stay outside this
		// try/catch, otherwise an unrelated error thrown by a downstream
		// handler would be swallowed here and misreported as a 401.
		let payload: Record<string, unknown>;
		try {
			// Normalize the public key to handle Cloudflare Workers environment
			const normalizedPublicKey = normalizeKey(c.env.JWT_PUBLIC_KEY);
			// Use verify directly instead of creating middleware
			payload = await verify(token, normalizedPublicKey, "EdDSA");
		} catch (error) {
			if (error instanceof JwtTokenExpired) {
				return c.json(
					{ message: "Unauthorized - Token expired" },
					HttpStatusCodes.UNAUTHORIZED
				);
			}
			if (
				error instanceof JwtTokenSignatureMismatched ||
				error instanceof JwtTokenInvalid
			) {
				return c.json(
					{ message: "Unauthorized - Invalid token" },
					HttpStatusCodes.UNAUTHORIZED
				);
			}
			return c.json(
				{ message: "Unauthorized - Invalid or missing token!" },
				HttpStatusCodes.UNAUTHORIZED
			);
		}

		if (payload && typeof payload === "object") {
			c.set("user", {
				id: payload.id as string,
				type: payload.type as (typeof UserType)[keyof typeof UserType],
			});
		}

		await next();
	};
};

/**
 * Like jwtAuth, but for public routes that want to know the caller's
 * identity *when available* (e.g. to compute per-customer fields like
 * `isInCart`) without forcing a 401 for guests. Invalid/missing tokens are
 * silently ignored — `c.get("user")` just stays undefined.
 */
export const optionalAuth = (): MiddlewareHandler<AppBindings> => {
	return async (c, next) => {
		const authHeader = c.req.header("Authorization");
		if (authHeader?.startsWith("Bearer ")) {
			const token = authHeader.substring(7);
			try {
				const normalizedPublicKey = normalizeKey(c.env.JWT_PUBLIC_KEY);
				const payload = await verify(token, normalizedPublicKey, "EdDSA");
				if (payload && typeof payload === "object") {
					c.set("user", {
						id: payload.id as string,
						type: payload.type as (typeof UserType)[keyof typeof UserType],
					});
				}
			} catch (_error) {
				// Ignore — treat as an unauthenticated (guest) request.
			}
		}
		await next();
	};
};

export const requireRole = (
	...roles: (typeof UserType)[keyof typeof UserType][]
): MiddlewareHandler<AppBindings> => {
	return async (c, next) => {
		const user = c.get("user");
		if (!user || !roles.includes(user.type)) {
			return c.json(
				{ message: "Forbidden - Insufficient permissions" },
				HttpStatusCodes.FORBIDDEN
			);
		}
		await next();
	};
};

/**
 * requirePermission checks that the authenticated admin has the given module
 * in their permission[] array. Super admins bypass the check entirely.
 *
 * Must be used AFTER jwtAuth() and requireRole(UserType.ADMIN).
 */
export const requirePermission = (
	module: AdminModule
): MiddlewareHandler<AppBindings> => {
	return async (c, next) => {
		const user = c.get("user");

		// jwtAuth + requireRole(ADMIN) should already guard this, but be defensive
		if (!user || user.type !== UserType.ADMIN) {
			return c.json(
				{ message: "Forbidden - Admins only" },
				HttpStatusCodes.FORBIDDEN
			);
		}

		const db = c.get("db");
		const admin = await adminQueries.findOne({ userId: user.id }, db);

		if (!admin) {
			return c.json(
				{ message: "Forbidden - Admin record not found" },
				HttpStatusCodes.FORBIDDEN
			);
		}

		// Super admin bypasses all permission checks
		if (admin.isSuperAdmin) {
			await next();
			return;
		}

		if (!admin.permission.includes(module)) {
			return c.json(
				{ message: `Forbidden - Missing access to module: ${module}` },
				HttpStatusCodes.FORBIDDEN
			);
		}

		await next();
	};
};
