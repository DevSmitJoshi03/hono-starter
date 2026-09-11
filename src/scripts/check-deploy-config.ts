/** biome-ignore-all lint/suspicious/noConsole: CLI script output */
/**
 * Predeploy safety net: confirms every Cloudflare resource wrangler.jsonc
 * references (Hyperdrive config, R2 bucket) actually exists in the
 * currently-authenticated account. Rate-limit `namespace_id`s need no such
 * check — Cloudflare treats those as arbitrary developer-chosen values, not
 * something you provision first.
 *
 * Without this, a stale/placeholder id in wrangler.jsonc deploys "successfully"
 * (wrangler doesn't validate resource ids at deploy time) and only fails once
 * a request actually touches the binding in production.
 *
 * Wired as the `predeploy` script — runs automatically before `bun run deploy`.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

interface WranglerConfig {
	hyperdrive?: { binding: string; id: string }[];
	r2_buckets?: { binding: string; bucket_name: string }[];
}

function readWranglerConfig(): WranglerConfig {
	const raw = readFileSync("wrangler.jsonc", "utf8");
	// Strip JSONC comments so the rest can go through JSON.parse.
	const stripped = raw
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/.*$/gm, "$1");
	return JSON.parse(stripped);
}

function run(cmd: string): string {
	return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

let failed = false;
function fail(message: string) {
	failed = true;
	console.error(`\n❌ ${message}`);
}

const config = readWranglerConfig();

for (const hd of config.hyperdrive ?? []) {
	try {
		const output = run("wrangler hyperdrive list");
		if (!output.includes(hd.id)) {
			fail(
				`Hyperdrive id "${hd.id}" (binding ${hd.binding}) was not found in ` +
					`the connected Cloudflare account.\n` +
					`  Create it:  wrangler hyperdrive create <name> --connection-string="<postgres-url>"\n` +
					`  Then paste the returned id into wrangler.jsonc.`
			);
		}
	} catch {
		console.warn(
			`⚠️  Could not verify Hyperdrive config "${hd.id}" — is wrangler authenticated? Skipping.`
		);
	}
}

for (const bucket of config.r2_buckets ?? []) {
	try {
		const output = run("wrangler r2 bucket list");
		if (!output.includes(bucket.bucket_name)) {
			fail(
				`R2 bucket "${bucket.bucket_name}" (binding ${bucket.binding}) was ` +
					`not found in the connected Cloudflare account.\n` +
					`  Create it:  wrangler r2 bucket create ${bucket.bucket_name}`
			);
		}
	} catch {
		console.warn(
			`⚠️  Could not verify R2 bucket "${bucket.bucket_name}" — is wrangler authenticated? Skipping.`
		);
	}
}

if (failed) {
	console.error(
		"\n✋ Deploy blocked — fix the resources above, or update wrangler.jsonc " +
			"if these were leftover placeholders.\n"
	);
	process.exit(1);
}

console.log(
	"✅ wrangler.jsonc resources verified against the connected Cloudflare account."
);
