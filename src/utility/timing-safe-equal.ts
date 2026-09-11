export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a[i] ^ b[i];
	}

	return result === 0;
}

const utf8 = new TextEncoder();

/** Constant-time string comparison (for OTPs, tokens, etc.). */
export function timingSafeEqualString(a: string, b: string): boolean {
	return timingSafeEqual(utf8.encode(a), utf8.encode(b));
}
