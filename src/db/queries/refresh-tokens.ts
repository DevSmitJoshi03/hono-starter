import { and, count, desc, eq, isNotNull, lt, or, type SQL } from "drizzle-orm";

import type { DB, DBTransaction } from "@/db/index";
import refreshTokens, {
	type InsertRefreshToken,
	type PatchRefreshToken,
	type SelectRefreshToken,
} from "@/db/schema/refresh-tokens";

export async function findOne(
	data: { id?: string; userId?: string; tokenHash?: string },
	db: DB | DBTransaction
): Promise<SelectRefreshToken | null> {
	const conditions: SQL[] = [];

	if (data.id) {
		conditions.push(eq(refreshTokens.id, data.id));
	}

	if (data.userId) {
		conditions.push(eq(refreshTokens.userId, data.userId));
	}

	if (data.tokenHash) {
		conditions.push(eq(refreshTokens.tokenHash, data.tokenHash));
	}

	if (conditions.length === 0) {
		return null;
	}

	try {
		const result = await db
			.select()
			.from(refreshTokens)
			.where(and(...conditions))
			.limit(1);

		return result[0] ?? null;
	} catch (_err) {
		throw new Error("Unable to fetch refresh token");
	}
}

export async function create(
	data: InsertRefreshToken,
	db: DB | DBTransaction
): Promise<SelectRefreshToken | null> {
	try {
		const [newRefreshToken] = await db
			.insert(refreshTokens)
			.values(data)
			.returning();
		return newRefreshToken ?? null;
	} catch (_err) {
		throw new Error("Unable to create refresh token");
	}
}

export async function update(
	data: PatchRefreshToken,
	db: DB | DBTransaction
): Promise<SelectRefreshToken | null> {
	try {
		const [updatedRefreshToken] = await db
			.update(refreshTokens)
			.set(data)
			.where(eq(refreshTokens.id, data.id))
			.returning();

		return updatedRefreshToken ?? null;
	} catch (_err) {
		throw new Error("Unable to update refresh token");
	}
}

export async function removeAll(
	data: { userId: string },
	db: DB | DBTransaction
): Promise<void> {
	try {
		await db.delete(refreshTokens).where(eq(refreshTokens.userId, data.userId));
	} catch (_err) {
		throw new Error("Unable to delete refresh tokens");
	}
}

/** Revokes an entire token family (used on detected reuse of a rotated token). */
export async function removeByFamily(
	data: { familyId: string },
	db: DB | DBTransaction
): Promise<void> {
	try {
		await db
			.delete(refreshTokens)
			.where(eq(refreshTokens.familyId, data.familyId));
	} catch (_err) {
		throw new Error("Unable to delete refresh token family");
	}
}

/** Marks a token as consumed by a rotation instead of deleting it, so a later
 *  presentation of the same token can be recognised as reuse. */
export async function markRotated(
	data: { id: string },
	db: DB | DBTransaction
): Promise<void> {
	try {
		await db
			.update(refreshTokens)
			.set({ rotatedAt: new Date() })
			.where(eq(refreshTokens.id, data.id));
	} catch (_err) {
		throw new Error("Unable to mark refresh token rotated");
	}
}

export async function remove(
	data: { id: string },
	db: DB | DBTransaction
): Promise<SelectRefreshToken | null> {
	try {
		const [deletedRefreshToken] = await db
			.delete(refreshTokens)
			.where(eq(refreshTokens.id, data.id))
			.returning();

		return deletedRefreshToken ?? null;
	} catch (_err) {
		throw new Error("Unable to delete refresh token");
	}
}

/**
 * Deletes rows that no longer serve a purpose: fully expired tokens, and
 * rotated tokens past a grace window (kept that long so a reuse — see
 * markRotated / refreshToken handler — can still be detected; once nobody
 * has retried with the old token in ROTATED_GRACE_MS, it's safe to drop).
 * Run on a schedule (see src/scheduled/prune-stale-auth-records.ts) — without
 * this, rotated/expired rows accumulate forever.
 */
export async function pruneStale(
	db: DB | DBTransaction,
	rotatedGraceMs = 7 * 24 * 60 * 60 * 1000
): Promise<number> {
	const now = new Date();
	const rotatedCutoff = new Date(now.getTime() - rotatedGraceMs);

	try {
		const deleted = await db
			.delete(refreshTokens)
			.where(
				or(
					lt(refreshTokens.expiresAt, now),
					and(
						isNotNull(refreshTokens.rotatedAt),
						lt(refreshTokens.rotatedAt, rotatedCutoff)
					)
				)
			)
			.returning({ id: refreshTokens.id });

		return deleted.length;
	} catch (_err) {
		throw new Error("Unable to prune stale refresh tokens");
	}
}

export async function findAll(db: DB | DBTransaction) {
	const conditions: SQL[] = [];

	const refreshTokensResult = await db
		.select()
		.from(refreshTokens)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(refreshTokens.createdAt));

	const totalCountResult = await db
		.select({ count: count() })
		.from(refreshTokens)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	const totalCount = totalCountResult[0]?.count || 0;

	return { data: refreshTokensResult, totalCount };
}

export async function findAllWithPagination(
	data: { skip: number; limit: number; searchQuery?: string },
	db: DB | DBTransaction
) {
	const conditions: SQL[] = [];

	if (data.searchQuery?.trim()) {
		conditions.push(eq(refreshTokens.userId, data.searchQuery.trim()));
	}

	const refreshTokensResult = await db
		.select()
		.from(refreshTokens)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(refreshTokens.createdAt))
		.offset(data.skip)
		.limit(data.limit);

	const totalCountResult = await db
		.select({ count: count() })
		.from(refreshTokens)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	const totalCount = totalCountResult[0]?.count || 0;

	return { data: refreshTokensResult, totalCount };
}
