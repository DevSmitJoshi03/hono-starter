import path from "node:path";
import { describe, expect, it } from "vitest";

import onError from "@/middlewares/on-error.js";

async function makeContext(env?: Record<string, unknown>) {
	const { Context } = await import(
		path.join(process.cwd(), "node_modules/hono/dist/context.js")
	);
	const req = new Request("http://localhost/");
	const context = new Context(req);
	if (env) context.env = env;
	return context;
}

describe("onError", () => {
	it("hides 5xx error messages in production (NODE_ENV from context)", async () => {
		const context = await makeContext({ NODE_ENV: "production" });
		const response = await onError(new Error("Test error"), context);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			message: "Internal server error",
			stack: undefined,
		});
	});

	it("hides 5xx error messages in production (NODE_ENV from process.env)", async () => {
		const context = await makeContext();
		// biome-ignore lint/style/noProcessEnv: required for test
		process.env.NODE_ENV = "production";
		const response = await onError(new Error("Test error"), context);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			message: "Internal server error",
			stack: undefined,
		});
	});

	it("surfaces the real message and stack outside production", async () => {
		const context = await makeContext({ NODE_ENV: "development" });
		const response = await onError(new Error("Test error"), context);
		expect(response.status).toBe(500);
		const json = (await response.json()) as { message: string; stack?: string };
		expect(json.message).toBe("Test error");
		expect(json.stack).toBeTypeOf("string");
	});

	it("passes through author-controlled 4xx messages in production", async () => {
		const context = await makeContext({ NODE_ENV: "production" });
		const err = Object.assign(new Error("Email already in use"), {
			status: 409,
		});
		const response = await onError(err, context);
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			message: "Email already in use",
			stack: undefined,
		});
	});
});
