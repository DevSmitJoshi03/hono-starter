import type { DB } from "@/db";
import * as adminQueries from "@/db/queries/admin";
import * as customerQueries from "@/db/queries/customer";
import * as refreshTokensQueries from "@/db/queries/refresh-tokens";
import * as usersQueries from "@/db/queries/user";
import * as verificationsQueries from "@/db/queries/verification";
import type { SelectAdmin } from "@/db/schema/admin";
import type { SelectCustomer } from "@/db/schema/customer";
import { UserType } from "@/db/schema/user";
import type { AppRouteHandler } from "@/lib/types";
import { generateRefreshToken, hashToken } from "@/utility/crypto";
import { sendEmail } from "@/utility/email";
import { otpEmailHtml } from "@/utility/email-templates";
import { HttpStatusCodes } from "@/utility/http-status";
import { issueJWT } from "@/utility/jwt";
import { generateOTP } from "@/utility/otp";
import { hashPassword } from "@/utility/password";
import {
	clearRefreshTokenCookie,
	issueRefreshToken,
	readRefreshToken,
	refreshTokenDeliveryMode,
} from "@/utility/refresh-token-delivery";
import { ErrorCodes, failure, success } from "@/utility/response";
import { timingSafeEqualString } from "@/utility/timing-safe-equal";
import type {
	ForgotPasswordRoute,
	LogoutRoute,
	RefreshTokenRoute,
	ResetPasswordRoute,
	VerifyOtpRoute,
} from "./auth.routes";

// A verification code is burned after this many failed attempts.
const MAX_OTP_ATTEMPTS = 5;
// Identical response for every forgot-password outcome, so the endpoint can't
// be used to discover which emails have accounts.
const FORGOT_PASSWORD_MESSAGE =
	"If an account exists for that email, a reset code has been sent.";
const INVALID_OTP_MESSAGE = "Invalid or expired code";
const OTP_LOCKED_MESSAGE = "Too many invalid attempts. Request a new code.";

type OtpCheck = { ok: true } | { ok: false; message: string };

/**
 * Validates a submitted OTP against the stored verification, counting failures
 * and burning the code once MAX_OTP_ATTEMPTS is reached. Does not consume the
 * code on success — the caller (reset-password) removes it inside its own
 * transaction. Uses a constant-time comparison and a single generic failure
 * message so nothing distinguishes "no code", "expired", and "wrong digits".
 */
async function checkOtp(
	db: DB,
	identifier: string,
	otp: string
): Promise<OtpCheck> {
	const verification = await verificationsQueries.findOne({ identifier }, db);
	if (!verification) return { ok: false, message: INVALID_OTP_MESSAGE };

	if (new Date(verification.expiresAt) < new Date()) {
		await verificationsQueries.remove({ identifier }, db);
		return { ok: false, message: INVALID_OTP_MESSAGE };
	}

	if (!timingSafeEqualString(verification.value, otp)) {
		const attempts = await verificationsQueries.incrementAttempts(
			{ identifier },
			db
		);
		if (attempts !== null && attempts >= MAX_OTP_ATTEMPTS) {
			await verificationsQueries.remove({ identifier }, db);
			return { ok: false, message: OTP_LOCKED_MESSAGE };
		}
		return { ok: false, message: INVALID_OTP_MESSAGE };
	}

	return { ok: true };
}

export const refreshToken: AppRouteHandler<RefreshTokenRoute> = async (c) => {
	const db = c.var.db;
	const token = readRefreshToken(c);

	if (!token) {
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, "Invalid refresh token"),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	const tokenHash = await hashToken(token);
	const existingToken = await refreshTokensQueries.findOne({ tokenHash }, db);

	if (!existingToken) {
		clearRefreshTokenCookie(c);
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, "Invalid refresh token"),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	// Reuse detection: this token was already spent by a previous rotation, yet
	// it's being presented again. Either the legit client and a thief both hold
	// a copy — revoke the whole family so neither can continue.
	if (existingToken.rotatedAt) {
		c.var.logger.warn(
			{ userId: existingToken.userId, familyId: existingToken.familyId },
			"Refresh token reuse detected — revoking token family"
		);
		await refreshTokensQueries.removeByFamily(
			{ familyId: existingToken.familyId },
			db
		);
		clearRefreshTokenCookie(c);
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, "Session revoked. Please log in again."),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	if (new Date(existingToken.expiresAt) < new Date()) {
		await refreshTokensQueries.remove({ id: existingToken.id }, db);
		clearRefreshTokenCookie(c);
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, "Refresh token has expired"),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	// Keep the row (marked rotated) so a later reuse can be detected.
	await refreshTokensQueries.markRotated({ id: existingToken.id }, db);

	const tokenUser = await usersQueries.findOne(
		{ id: existingToken.userId },
		db
	);
	if (!tokenUser) {
		return c.json(
			failure(ErrorCodes.NOT_FOUND, "User not found"),
			HttpStatusCodes.NOT_FOUND
		);
	}

	let profileData:
		| (SelectAdmin & { email: string })
		| (SelectCustomer & { email: string });

	if (tokenUser.type === UserType.ADMIN) {
		const admin = await adminQueries.findOne({ userId: tokenUser.id }, db);
		if (!admin) {
			return c.json(
				failure(ErrorCodes.NOT_FOUND, "Admin profile not found"),
				HttpStatusCodes.NOT_FOUND
			);
		}
		profileData = { ...admin, email: tokenUser.email };
	} else {
		const customer = await customerQueries.findOne(
			{ userId: tokenUser.id },
			db
		);
		if (!customer) {
			return c.json(
				failure(ErrorCodes.NOT_FOUND, "Customer profile not found"),
				HttpStatusCodes.NOT_FOUND
			);
		}
		profileData = { ...customer, email: tokenUser.email };
	}

	const accessToken = await issueJWT(c, {
		id: existingToken.userId,
		type: tokenUser.type,
	});
	const newRefreshToken = generateRefreshToken();

	const inserted = await refreshTokensQueries.create(
		{
			userId: existingToken.userId,
			familyId: existingToken.familyId,
			tokenHash: await hashToken(newRefreshToken),
			deviceId: existingToken.deviceId,
			userAgent: existingToken.userAgent,
			ipAddress: existingToken.ipAddress,
			platform: existingToken.platform,
			expiresAt: new Date(Date.now() + c.env.REFRESH_TOKEN_TTL_MS),
		},
		db
	);

	if (!inserted) {
		return c.json(
			failure(ErrorCodes.INTERNAL_ERROR, "Failed to rotate refresh token"),
			HttpStatusCodes.INTERNAL_SERVER_ERROR
		);
	}

	// The original login decided cookie vs. body delivery based on platform;
	// a rotation keeps using that same delivery mode.
	const returnedRefreshToken = issueRefreshToken(
		c,
		newRefreshToken,
		existingToken.platform,
		c.env.REFRESH_TOKEN_TTL_MS
	);

	return c.json(
		success({
			accessToken,
			refreshToken: returnedRefreshToken,
			refreshTokenDelivery: refreshTokenDeliveryMode(existingToken.platform),
			type: tokenUser.type,
			data: profileData,
		}),
		HttpStatusCodes.OK
	);
};

export const logout: AppRouteHandler<LogoutRoute> = async (c) => {
	const db = c.var.db;
	const token = readRefreshToken(c);

	if (!token) {
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, "Invalid refresh token"),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	const tokenHash = await hashToken(token);
	const existingToken = await refreshTokensQueries.findOne({ tokenHash }, db);

	// Always clear the cookie and report success — logout should be idempotent
	// and not reveal whether the token was known.
	if (existingToken) {
		await refreshTokensQueries.removeByFamily(
			{ familyId: existingToken.familyId },
			db
		);
	}

	clearRefreshTokenCookie(c);

	return c.json(
		success(null, { message: "Logout successful" }),
		HttpStatusCodes.OK
	);
};

export const forgotPassword: AppRouteHandler<ForgotPasswordRoute> = async (
	c
) => {
	const db = c.var.db;
	const { email, type } = c.req.valid("json");

	const isDev = c.env.NODE_ENV !== "production";

	// Misconfiguration check runs regardless of whether the account exists, so
	// the timing/response stays uniform.
	if (!isDev && !c.env.EMAIL) {
		c.var.logger.error(
			"EMAIL (send_email) binding is not configured — cannot deliver OTP"
		);
		return c.json(
			failure(ErrorCodes.INTERNAL_ERROR, "Email service is not configured"),
			HttpStatusCodes.INTERNAL_SERVER_ERROR
		);
	}

	const user = await usersQueries.findOne({ email, type }, db);

	// Only do the OTP + email work for a real account, but always return the
	// same body so callers can't enumerate registered emails.
	if (user) {
		const identifier = `${email}:${type}`;
		const otp = isDev ? "111111" : generateOTP();
		const expiresAt = new Date(Date.now() + c.env.OTP_EXPIRES_IN_MS);

		try {
			await db.transaction(async (tx) => {
				await verificationsQueries.upsert(
					{ identifier, value: otp, expiresAt },
					tx
				);
			});
		} catch (error) {
			c.var.logger.error({ err: error }, "Failed to persist OTP");
			return c.json(
				failure(ErrorCodes.INTERNAL_ERROR, "Failed to generate reset code"),
				HttpStatusCodes.INTERNAL_SERVER_ERROR
			);
		}

		if (!isDev && c.env.EMAIL) {
			const brand = {
				name: c.env.BRAND_NAME,
				siteUrl: c.env.SITE_URL,
				accentColor: c.env.BRAND_ACCENT_COLOR,
				logoUrl: c.env.LOGO_URL,
			};
			try {
				await sendEmail(c.env.EMAIL, {
					to: email,
					from: { email: c.env.EMAIL_FROM_ADDRESS, name: c.env.BRAND_NAME },
					subject: `${brand.name} — Password Reset OTP`,
					html: otpEmailHtml(otp, brand),
				});
			} catch (error) {
				c.var.logger.error({ err: error }, "Email send failed");
				return c.json(
					failure(ErrorCodes.INTERNAL_ERROR, "Failed to send reset code"),
					HttpStatusCodes.INTERNAL_SERVER_ERROR
				);
			}
		}
	}

	return c.json(
		success(null, { message: FORGOT_PASSWORD_MESSAGE }),
		HttpStatusCodes.OK
	);
};

export const verifyOtp: AppRouteHandler<VerifyOtpRoute> = async (c) => {
	const db = c.var.db;
	const { email, type, otp } = c.req.valid("json");

	const identifier = `${email}:${type}`;
	const check = await checkOtp(db, identifier, otp);
	if (!check.ok) {
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, check.message),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	return c.json(
		success(null, { message: "OTP verified successfully" }),
		HttpStatusCodes.OK
	);
};

export const resetPassword: AppRouteHandler<ResetPasswordRoute> = async (c) => {
	const db = c.var.db;
	const { email, type, otp, newPassword } = c.req.valid("json");

	const identifier = `${email}:${type}`;
	const check = await checkOtp(db, identifier, otp);
	if (!check.ok) {
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, check.message),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	const user = await usersQueries.findOne({ email, type }, db);
	if (!user) {
		// The code was valid but the account is gone — treat as invalid code.
		await verificationsQueries.remove({ identifier }, db);
		return c.json(
			failure(ErrorCodes.UNAUTHORIZED, INVALID_OTP_MESSAGE),
			HttpStatusCodes.UNAUTHORIZED
		);
	}

	const hashedPassword = await hashPassword(newPassword);

	try {
		await db.transaction(async (tx) => {
			await usersQueries.updatePassword(
				{ id: user.id, password: hashedPassword },
				tx
			);
			await verificationsQueries.remove({ identifier }, tx);
		});
	} catch {
		return c.json(
			failure(ErrorCodes.INTERNAL_ERROR, "Failed to reset password"),
			HttpStatusCodes.INTERNAL_SERVER_ERROR
		);
	}

	return c.json(
		success(null, { message: "Password reset successfully" }),
		HttpStatusCodes.OK
	);
};
