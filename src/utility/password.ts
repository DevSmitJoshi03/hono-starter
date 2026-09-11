import { timingSafeEqual } from "./timing-safe-equal";

const ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"]
	);

	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt,
			iterations: ITERATIONS,
		},
		key,
		256
	);

	return `pbkdf2:${btoa(String.fromCharCode(...salt))}:${btoa(
		String.fromCharCode(...new Uint8Array(bits))
	)}`;
}

export async function verifyPassword(
	password: string,
	stored: string
): Promise<boolean> {
	if (!stored.startsWith("pbkdf2:")) return false;

	const [, saltB64, hashB64] = stored.split(":");
	const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
	const expected = Uint8Array.from(atob(hashB64), (c) => c.charCodeAt(0));

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"]
	);

	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt,
			iterations: ITERATIONS,
		},
		key,
		256
	);

	const actual = new Uint8Array(bits);
	return timingSafeEqual(actual, expected);
}
