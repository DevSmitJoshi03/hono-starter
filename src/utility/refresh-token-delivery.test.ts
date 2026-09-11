import path from "node:path";
import { describe, expect, it } from "vitest";
import { Platform } from "@/db/schema/refresh-tokens";
import {
	clearRefreshTokenCookie,
	isNativePlatform,
	issueRefreshToken,
	readRefreshToken,
	refreshTokenDeliveryMode,
} from "@/utility/refresh-token-delivery";

async function makeContext(req: Request) {
	const { Context } = await import(
		path.join(process.cwd(), "node_modules/hono/dist/context.js")
	);
	return new Context(req);
}

describe("refreshTokenDeliveryMode / isNativePlatform", () => {
	it("treats ios/android/desktop as native (body delivery)", () => {
		for (const p of [Platform.IOS, Platform.ANDROID, Platform.DESKTOP]) {
			expect(isNativePlatform(p)).toBe(true);
			expect(refreshTokenDeliveryMode(p)).toBe("body");
		}
	});

	it("treats web/admin-dashboard/unknown as non-native (cookie delivery)", () => {
		for (const p of [
			Platform.WEB,
			Platform.ADMIN_DASHBOARD,
			Platform.UNKNOWN,
		]) {
			expect(isNativePlatform(p)).toBe(false);
			expect(refreshTokenDeliveryMode(p)).toBe("cookie");
		}
	});
});

describe("issueRefreshToken", () => {
	it("web: sets the cookie, returns undefined for the body", async () => {
		const c = await makeContext(new Request("http://localhost/"));
		const returned = issueRefreshToken(c, "raw-token", Platform.WEB, 60_000);

		expect(returned).toBeUndefined();
		expect(c.res.headers.get("set-cookie")).toContain("refreshToken=raw-token");
		expect(c.res.headers.get("set-cookie")).toContain("HttpOnly");
	});

	it("ios: sets the cookie AND returns the token for the body", async () => {
		const c = await makeContext(new Request("http://localhost/"));
		const returned = issueRefreshToken(c, "raw-token", Platform.IOS, 60_000);

		expect(returned).toBe("raw-token");
		expect(c.res.headers.get("set-cookie")).toContain("refreshToken=raw-token");
	});
});

describe("readRefreshToken", () => {
	it("reads from the cookie when present", async () => {
		const c = await makeContext(
			new Request("http://localhost/", {
				headers: { cookie: "refreshToken=from-cookie" },
			})
		);
		expect(readRefreshToken(c)).toBe("from-cookie");
	});

	it("falls back to the x-refresh-token header (native clients)", async () => {
		const c = await makeContext(
			new Request("http://localhost/", {
				headers: { "x-refresh-token": "from-header" },
			})
		);
		expect(readRefreshToken(c)).toBe("from-header");
	});

	it("prefers the cookie over the header when both are present", async () => {
		const c = await makeContext(
			new Request("http://localhost/", {
				headers: {
					cookie: "refreshToken=from-cookie",
					"x-refresh-token": "from-header",
				},
			})
		);
		expect(readRefreshToken(c)).toBe("from-cookie");
	});

	it("returns undefined when neither is present", async () => {
		const c = await makeContext(new Request("http://localhost/"));
		expect(readRefreshToken(c)).toBeUndefined();
	});
});

describe("clearRefreshTokenCookie", () => {
	it("expires the cookie", async () => {
		const c = await makeContext(new Request("http://localhost/"));
		clearRefreshTokenCookie(c);
		const setCookie = c.res.headers.get("set-cookie");
		expect(setCookie).toContain("refreshToken=");
		expect(setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
	});
});
