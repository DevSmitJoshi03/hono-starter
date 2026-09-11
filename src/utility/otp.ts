/**
 * Generates a numeric one-time passcode.
 *
 * Uses rejection sampling so every digit 0-9 is equally likely — taking
 * `byte % 10` directly would bias toward 0-5 (256 is not a multiple of 10).
 */
export function generateOTP(length = 6): string {
	let out = "";
	while (out.length < length) {
		const buf = crypto.getRandomValues(new Uint8Array(length));
		for (const b of buf) {
			if (b < 250) {
				out += (b % 10).toString();
				if (out.length === length) break;
			}
		}
	}
	return out;
}
