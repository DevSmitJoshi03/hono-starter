import { describe, expect, it } from "vitest";

import { generateOTP } from "@/utility/otp";
import { timingSafeEqualString } from "@/utility/timing-safe-equal";

describe("generateOTP", () => {
	it("returns a 6-digit numeric string by default", () => {
		for (let i = 0; i < 200; i++) {
			const otp = generateOTP();
			expect(otp).toMatch(/^\d{6}$/);
		}
	});

	it("honours a custom length", () => {
		expect(generateOTP(4)).toMatch(/^\d{4}$/);
		expect(generateOTP(8)).toMatch(/^\d{8}$/);
	});

	it("covers every digit 0-9 across many samples", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 500; i++) {
			for (const d of generateOTP()) seen.add(d);
		}
		expect(seen.size).toBe(10);
	});
});

describe("timingSafeEqualString", () => {
	it("matches equal strings and rejects others", () => {
		expect(timingSafeEqualString("123456", "123456")).toBe(true);
		expect(timingSafeEqualString("123456", "123457")).toBe(false);
		expect(timingSafeEqualString("123456", "12345")).toBe(false);
	});
});
