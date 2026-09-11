/** biome-ignore-all lint/suspicious/noConsole: CLI script output */
import { generateKeyPairSync } from "node:crypto";

// utility/jwt.ts signs/verifies with hono/jwt's "EdDSA" algorithm, which is
// Ed25519 - keys must be PKCS8 (private) / SPKI (public) PEM to match what
// hono's importPrivateKey/importPublicKey expect.
const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
	publicKeyEncoding: { type: "spki", format: "pem" },
	privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

/**
 * .env stores each key on a single line. normalizeKey() (utility/jwt.ts)
 * converts a literal "\n" (backslash + n) back into a real newline before
 * the PEM is parsed - that round trip exists because Cloudflare Workers env
 * vars/secrets can't hold real multi-line values, so the key has to survive
 * as one line here too.
 */
function toEnvLine(pem: string): string {
	return pem.trim().split("\n").join("\\n");
}

console.log(
	"Generated an Ed25519 key pair for JWT_PRIVATE_KEY / JWT_PUBLIC_KEY (EdDSA).\n"
);
console.log("Paste these into .env (or .dev.vars):\n");
console.log(`JWT_PRIVATE_KEY=${toEnvLine(privateKey)}`);
console.log(`JWT_PUBLIC_KEY=${toEnvLine(publicKey)}`);
console.log(
	"\nFor production, set the same single-line values via `wrangler secret put`."
);
