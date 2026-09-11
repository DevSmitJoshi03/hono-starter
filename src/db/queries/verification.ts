import { eq, lt, sql } from "drizzle-orm";

import type { DB, DBTransaction } from "@/db/index";
import verifications, {
	type InsertVerification,
	type SelectVerification,
} from "@/db/schema/verification";

export async function findOne(
	data: { identifier: string },
	db: DB | DBTransaction
): Promise<SelectVerification | null> {
	try {
		const result = await db
			.select()
			.from(verifications)
			.where(eq(verifications.identifier, data.identifier))
			.limit(1);

		return result[0] ?? null;
	} catch (_err) {
		throw new Error("Unable to fetch verification");
	}
}

export async function upsert(
	data: InsertVerification,
	db: DB | DBTransaction
): Promise<SelectVerification | null> {
	try {
		await db
			.delete(verifications)
			.where(eq(verifications.identifier, data.identifier));

		const [newVerification] = await db
			.insert(verifications)
			.values(data)
			.returning();

		return newVerification ?? null;
	} catch (_err) {
		throw new Error("Unable to upsert verification");
	}
}

/**
 * Atomically increments the failed-attempt counter for a verification and
 * returns the new value. Returns null if no row exists for the identifier.
 */
export async function incrementAttempts(
	data: { identifier: string },
	db: DB | DBTransaction
): Promise<number | null> {
	try {
		const [updated] = await db
			.update(verifications)
			.set({ attempts: sql`${verifications.attempts} + 1` })
			.where(eq(verifications.identifier, data.identifier))
			.returning({ attempts: verifications.attempts });

		return updated?.attempts ?? null;
	} catch (_err) {
		throw new Error("Unable to update verification attempts");
	}
}

/**
 * Deletes verification codes past their expiry — a code that's never followed
 * up on (forgot-password requested, then abandoned) otherwise sits forever.
 * Run on a schedule alongside refreshTokensQueries.pruneStale (see
 * src/scheduled/prune-stale-auth-records.ts).
 */
export async function pruneExpired(db: DB | DBTransaction): Promise<number> {
	try {
		const deleted = await db
			.delete(verifications)
			.where(lt(verifications.expiresAt, new Date()))
			.returning({ id: verifications.id });

		return deleted.length;
	} catch (_err) {
		throw new Error("Unable to prune expired verifications");
	}
}

export async function remove(
	data: { identifier: string },
	db: DB | DBTransaction
): Promise<SelectVerification | null> {
	try {
		const [deleted] = await db
			.delete(verifications)
			.where(eq(verifications.identifier, data.identifier))
			.returning();

		return deleted ?? null;
	} catch (_err) {
		throw new Error("Unable to delete verification");
	}
}
