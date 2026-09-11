import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Platform } from "@/db/schema/refresh-tokens";
import type { AppBindings } from "@/lib/types";

const COOKIE_NAME = "refreshToken";
// Header native clients use to resend the refresh token (they have no
// browser-style cookie jar shared across the app's HTTP requests).
const HEADER_NAME = "x-refresh-token";

const NATIVE_PLATFORMS: ReadonlySet<string> = new Set([
	Platform.IOS,
	Platform.ANDROID,
	Platform.DESKTOP,
]);

/** True for platforms that can't rely on a browser-managed cookie jar. */
export function isNativePlatform(platform: string): boolean {
	return NATIVE_PLATFORMS.has(platform);
}

export type RefreshTokenDeliveryMode = "cookie" | "body";

/**
 * Which delivery mode a given platform gets. Every auth response includes
 * this (see AccessTokenResponseSchema / CustomerAuthDataSchema /
 * AdminLoginDataSchema) so a client that forgot to send `x-platform` sees
 * `"cookie"` with no `refreshToken` in the body and can tell immediately why
 * — instead of the session just silently dying when the access token expires.
 */
export function refreshTokenDeliveryMode(
	platform: string
): RefreshTokenDeliveryMode {
	return isNativePlatform(platform) ? "body" : "cookie";
}

/**
 * Issues a refresh token to the client, choosing delivery by platform:
 *
 * - Always set as an httpOnly, Secure cookie. This is what web/browser
 *   clients use, and it's a harmless no-op for native clients that don't
 *   persist cookies across requests.
 * - Also returned as a plain string ONLY for native app platforms
 *   (ios/android/desktop). Those apps have no shared cookie jar to rely on,
 *   so they store the token themselves (iOS Keychain / Android Keystore) and
 *   resend it via the `x-refresh-token` header. Browser clients never
 *   receive it in the JSON body, so a browser-side XSS payload can't read it
 *   the way it could a JS-accessible value — the cookie stays httpOnly.
 *
 * Returns the value to put in the response body's `refreshToken` field
 * (undefined for web/browser platforms).
 */
export function issueRefreshToken(
	c: Context<AppBindings>,
	token: string,
	platform: string,
	maxAgeMs: number
): string | undefined {
	setCookie(c, COOKIE_NAME, token, {
		httpOnly: true,
		secure: true,
		sameSite: "None",
		path: "/",
		maxAge: Math.floor(maxAgeMs / 1000),
	});

	return refreshTokenDeliveryMode(platform) === "body" ? token : undefined;
}

/**
 * Reads the refresh token from wherever the client sent it: the httpOnly
 * cookie (web) or the `x-refresh-token` header (native apps per above).
 */
export function readRefreshToken(c: Context<AppBindings>): string | undefined {
	return getCookie(c, COOKIE_NAME) || c.req.header(HEADER_NAME) || undefined;
}

export function clearRefreshTokenCookie(c: Context<AppBindings>): void {
	deleteCookie(c, COOKIE_NAME, { path: "/" });
}
