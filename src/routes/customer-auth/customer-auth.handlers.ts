import * as customerQueries from "@/db/queries/customer";
import * as refreshTokensQueries from "@/db/queries/refresh-tokens";
import * as usersQueries from "@/db/queries/user";
import { Platform } from "@/db/schema/refresh-tokens";
import { UserType } from "@/db/schema/user";
import type { AppRouteHandler } from "@/lib/types";
import { generateRefreshToken, hashToken } from "@/utility/crypto";
import { HttpStatusCodes } from "@/utility/http-status";
import { issueJWT } from "@/utility/jwt";
import { hashPassword, verifyPassword } from "@/utility/password";
import { resolveImage, saveImageToR2 } from "@/utility/r2-image";
import {
	issueRefreshToken,
	refreshTokenDeliveryMode,
} from "@/utility/refresh-token-delivery";
import { ErrorCodes, failure, success } from "@/utility/response";
import type {
	ChangePasswordRoute,
	CustomerLoginRoute,
	CustomerMeRoute,
	CustomerRegisterRoute,
	UpdateProfileRoute,
} from "./customer-auth.routes";

export const register: AppRouteHandler<CustomerRegisterRoute> = async (c) => {
	const db = c.var.db;
	const { email, password, name, phoneNumber } = c.req.valid("json");
	const headers = c.req.valid("header");

	const existing = await usersQueries.findOne(
		{ email, type: UserType.CUSTOMER },
		db
	);
	if (existing) {
		return c.json(
			failure(ErrorCodes.CONFLICT, "Email already registered"),
			HttpStatusCodes.CONFLICT
		);
	}

	const hashedPassword = await hashPassword(password);
	const userAgent = headers["user-agent"] ?? "Unknown";
	const ipAddress =
		c.req.header("CF-Connecting-IP") ??
		c.req.header("X-Forwarded-For") ??
		"Unknown";
	const deviceId = headers["x-device-id"] ?? "web-browser";
	const platform = headers["x-platform"] ?? Platform.WEB;
	const rawRefreshToken = generateRefreshToken();

	let userId: string;
	let customer: NonNullable<Awaited<ReturnType<typeof customerQueries.create>>>;

	try {
		const result = await db.transaction(async (tx) => {
			const user = await usersQueries.create(
				{ email, password: hashedPassword, type: UserType.CUSTOMER },
				tx
			);
			if (!user) throw new Error("Failed to create user");

			const created = await customerQueries.create(
				{ userId: user.id, name, phoneNumber },
				tx
			);
			if (!created) throw new Error("Failed to create customer profile");

			const inserted = await refreshTokensQueries.create(
				{
					userId: user.id,
					tokenHash: await hashToken(rawRefreshToken),
					deviceId,
					userAgent,
					ipAddress,
					platform,
					expiresAt: new Date(Date.now() + c.env.REFRESH_TOKEN_TTL_MS),
				},
				tx
			);
			if (!inserted) throw new Error("Failed to create refresh token");

			return { userId: user.id, customer: created };
		});

		userId = result.userId;
		customer = result.customer;
	} catch (error) {
		c.var.logger.error({ err: error }, "Customer registration failed");
		return c.json(
			failure(ErrorCodes.INTERNAL_ERROR, "Registration failed"),
			HttpStatusCodes.INTERNAL_SERVER_ERROR
		);
	}

	const accessToken = await issueJWT(c, {
		id: userId,
		type: UserType.CUSTOMER,
	});
	const returnedRefreshToken = issueRefreshToken(
		c,
		rawRefreshToken,
		platform,
		c.env.REFRESH_TOKEN_TTL_MS
	);

	return c.json(
		success(
			{
				accessToken,
				refreshToken: returnedRefreshToken,
				refreshTokenDelivery: refreshTokenDeliveryMode(platform),
				customer: { ...customer, email },
			},
			{ message: "Registration successful" }
		),
		HttpStatusCodes.CREATED
	);
};

export const login: AppRouteHandler<CustomerLoginRoute> = async (c) => {
	const db = c.var.db;
	const { email, password } = c.req.valid("json");
	const headers = c.req.valid("header");

	const user = await usersQueries.findOne(
		{ email, type: UserType.CUSTOMER },
		db
	);
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

	const customer = await customerQueries.findOne({ userId: user.id }, db);
	if (!customer) {
		return c.json(
			failure(ErrorCodes.NOT_FOUND, "Customer profile not found"),
			HttpStatusCodes.NOT_FOUND
		);
	}

	const rawRefreshToken = generateRefreshToken();
	const userAgent = headers["user-agent"] ?? "Unknown";
	const ipAddress =
		c.req.header("CF-Connecting-IP") ??
		c.req.header("X-Forwarded-For") ??
		"Unknown";
	const deviceId = headers["x-device-id"] ?? "web-browser";
	const platform = headers["x-platform"] ?? Platform.WEB;

	try {
		await db.transaction(async (tx) => {
			if (c.env.AUTH_MODE === "SINGLE") {
				await refreshTokensQueries.removeAll({ userId: user.id }, tx);
			}

			const inserted = await refreshTokensQueries.create(
				{
					userId: user.id,
					tokenHash: await hashToken(rawRefreshToken),
					deviceId,
					userAgent,
					ipAddress,
					platform,
					expiresAt: new Date(Date.now() + c.env.REFRESH_TOKEN_TTL_MS),
				},
				tx
			);
			if (!inserted) throw new Error("Failed to create refresh token");
		});
	} catch (error) {
		c.var.logger.error({ err: error }, "Customer login failed");
		return c.json(
			failure(ErrorCodes.INTERNAL_ERROR, "Failed to process login"),
			HttpStatusCodes.INTERNAL_SERVER_ERROR
		);
	}

	const accessToken = await issueJWT(c, {
		id: user.id,
		type: UserType.CUSTOMER,
	});
	const returnedRefreshToken = issueRefreshToken(
		c,
		rawRefreshToken,
		platform,
		c.env.REFRESH_TOKEN_TTL_MS
	);

	return c.json(
		success({
			accessToken,
			refreshToken: returnedRefreshToken,
			refreshTokenDelivery: refreshTokenDeliveryMode(platform),
			customer: { ...customer, email: user.email },
		}),
		HttpStatusCodes.OK
	);
};

export const me: AppRouteHandler<CustomerMeRoute> = async (c) => {
	const db = c.var.db;
	const user = c.get("user");

	if (!user) {
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, "Unauthorized"),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	try {
		const customer = await customerQueries.findOne({ userId: user.id }, db);
		if (!customer) {
			return c.json(
				failure(ErrorCodes.NOT_FOUND, "Customer profile not found"),
				HttpStatusCodes.NOT_FOUND
			);
		}

		const image = await resolveImage(c.env, customer.image ?? null);

		return c.json(success({ ...customer, image }), HttpStatusCodes.OK);
	} catch (err) {
		c.var.logger.error({ err }, "Failed to fetch customer profile");
		return c.json(
			failure(ErrorCodes.INTERNAL_ERROR, "Failed to fetch customer"),
			HttpStatusCodes.INTERNAL_SERVER_ERROR
		);
	}
};

export const updateProfile: AppRouteHandler<UpdateProfileRoute> = async (c) => {
	const db = c.var.db;
	const user = c.get("user");

	if (!user) {
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, "Unauthorized"),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	const { email, image: imageFile, ...customerFields } = c.req.valid("form");

	let imageMeta: Awaited<ReturnType<typeof saveImageToR2>> | undefined;
	if (imageFile instanceof File) {
		imageMeta = await saveImageToR2(
			c.env.R2_BUCKET,
			imageFile,
			imageFile.name,
			"customers/profile"
		);
	}

	try {
		const updated = await db.transaction(async (tx) => {
			const customer = await customerQueries.findOne({ userId: user.id }, tx);
			if (!customer) {
				throw Object.assign(new Error("Customer profile not found"), {
					code: "NOT_FOUND",
				});
			}

			if (email) {
				const existing = await usersQueries.findOne(
					{ email, type: user.type },
					tx
				);
				if (existing && existing.id !== user.id) {
					throw Object.assign(new Error("Email already in use"), {
						code: "CONFLICT",
					});
				}
				await usersQueries.update({ id: user.id, email }, tx);
			}

			const patch = {
				...customerFields,
				...(imageMeta !== undefined && { image: imageMeta }),
			};
			const hasCustomerUpdates = Object.keys(patch).length > 0;
			if (!hasCustomerUpdates) return customer;

			const result = await customerQueries.update(customer.id, patch, tx);
			if (!result) {
				throw Object.assign(new Error("Customer profile not found"), {
					code: "NOT_FOUND",
				});
			}
			return result;
		});

		return c.json(success(updated), HttpStatusCodes.OK);
	} catch (err) {
		if (err instanceof Error) {
			const code = (err as { code?: string }).code;
			if (code === "NOT_FOUND") {
				return c.json(
					failure(ErrorCodes.NOT_FOUND, err.message),
					HttpStatusCodes.NOT_FOUND
				);
			}
			if (code === "CONFLICT") {
				return c.json(
					failure(ErrorCodes.CONFLICT, err.message),
					HttpStatusCodes.CONFLICT
				);
			}
		}
		c.var.logger.error({ err }, "Failed to update customer profile");
		return c.json(
			failure(ErrorCodes.INTERNAL_ERROR, "Failed to update profile"),
			HttpStatusCodes.INTERNAL_SERVER_ERROR
		);
	}
};

export const changePassword: AppRouteHandler<ChangePasswordRoute> = async (
	c
) => {
	const db = c.var.db;
	const user = c.get("user");

	if (!user) {
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, "Unauthorized"),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	const { currentPassword, newPassword } = c.req.valid("json");

	try {
		const existingUser = await usersQueries.findOne({ id: user.id }, db);
		if (!existingUser) {
			return c.json(
				failure(ErrorCodes.UNAUTHORIZED, "Unauthorized"),
				HttpStatusCodes.UNAUTHORIZED
			);
		}

		const isValid = await verifyPassword(
			currentPassword,
			existingUser.password
		);
		if (!isValid) {
			return c.json(
				failure(ErrorCodes.UNAUTHORIZED, "Current password is incorrect"),
				HttpStatusCodes.UNAUTHORIZED
			);
		}

		const hashedNew = await hashPassword(newPassword);
		await usersQueries.updatePassword({ id: user.id, password: hashedNew }, db);

		return c.json(
			success({ message: "Password changed successfully" }),
			HttpStatusCodes.OK
		);
	} catch (err) {
		c.var.logger.error({ err }, "Failed to change customer password");
		return c.json(
			failure(ErrorCodes.INTERNAL_ERROR, "Failed to change password"),
			HttpStatusCodes.INTERNAL_SERVER_ERROR
		);
	}
};
