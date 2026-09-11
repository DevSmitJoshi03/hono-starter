/** biome-ignore-all lint/suspicious/noConsole: no request-scoped logger exists outside the fetch handler */
import type {
	ExecutionContext,
	ScheduledController,
} from "@cloudflare/workers-types";
import { createDb } from "@/db";
import * as refreshTokensQueries from "@/db/queries/refresh-tokens";
import * as verificationsQueries from "@/db/queries/verification";
import { parseEnv } from "@/env";

/**
 * Cron Trigger handler (see wrangler.jsonc `triggers.crons`) that deletes
 * auth bookkeeping rows once they can no longer serve a purpose:
 *  - refresh_tokens: expired, or rotated past the reuse-detection grace
 *    window (src/db/queries/refresh-tokens.ts pruneStale)
 *  - verifications: expired OTP codes nobody followed up on
 *
 * Without this, both tables grow forever — every login/refresh/OTP request
 * adds a row, nothing has removed one until now.
 */
export default async function pruneStaleAuthRecords(
	_controller: ScheduledController,
	rawEnv: unknown,
	_ctx: ExecutionContext
): Promise<void> {
	const env = parseEnv(rawEnv);
	const { db, client } = createDb(env);

	try {
		const [tokensDeleted, verificationsDeleted] = await Promise.all([
			refreshTokensQueries.pruneStale(db),
			verificationsQueries.pruneExpired(db),
		]);

		console.log(
			`[cron] pruned ${tokensDeleted} refresh_tokens, ${verificationsDeleted} verifications`
		);
	} catch (error) {
		console.error("[cron] prune-stale-auth-records failed", error);
		throw error;
	} finally {
		await client.end();
	}
}
