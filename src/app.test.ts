import { describe, expect, it } from "vitest";

import app from "@/app";

// End-to-end smoke tests that exercise the full middleware chain via
// app.request(), unlike the rest of the suite which tests units in
// isolation. Mainly guards the route wiring: which paths are public,
// which require auth, and that the OpenAPI doc reflects the real routes.
describe("app", () => {
	it("serves the OpenAPI doc and lists the current auth routes", async () => {
		const res = await app.request("/doc");
		expect(res.status).toBe(200);

		const body = (await res.json()) as { paths: Record<string, unknown> };
		const paths = Object.keys(body.paths);

		expect(paths).toContain("/customer/auth/register");
		expect(paths).toContain("/customer/auth/login");
		expect(paths).toContain("/admin/login");
		// There is no product/diamond split any more — just admin + customer.
		expect(paths).not.toContain("/product/auth/register");
		expect(paths).not.toContain("/diamond/auth/register");
	});

	it("index is public", async () => {
		const res = await app.request("/");
		expect(res.status).toBe(200);
	});

	it.each(["/customer/auth/register", "/customer/auth/login", "/admin/login"])(
		"%s is public and reaches request validation, not auth",
		async (path) => {
			const res = await app.request(path, {
				method: "POST",
				body: "{}",
				headers: { "content-type": "application/json" },
			});
			// 422 (validation) proves the request got past jwtAuth — an
			// unauthenticated request to a protected route would 401 instead.
			expect(res.status).toBe(422);
		}
	);

	it("rejects an unauthenticated request to a protected route", async () => {
		const res = await app.request("/customer/auth/me");
		expect(res.status).toBe(401);
	});

	it("falls through to 404 for an unknown path instead of 401", async () => {
		const res = await app.request("/this-route-does-not-exist");
		expect(res.status).toBe(404);
	});

	it.each(["/doc", "/reference"])(
		"closes %s in production — same shape as any unknown path",
		async (path) => {
			const res = await app.request(path, {}, { NODE_ENV: "production" });
			expect(res.status).toBe(404);
			const body = (await res.json()) as { message: string };
			expect(body.message).toBe(`Not Found - ${path}`);
		}
	);

	it.each(["/doc", "/reference"])(
		"%s stays open outside production",
		async (path) => {
			const res = await app.request(path, {}, { NODE_ENV: "development" });
			expect(res.status).toBe(200);
		}
	);
});
