import type { SQL } from "drizzle-orm";
import { and, eq } from "drizzle-orm";

import type { DB, DBTransaction } from "@/db/index";
import admins, {
	type InsertAdmin,
	type PatchAdmin,
	type SelectAdmin,
} from "@/db/schema/admin";

export async function findOne(
	data: { id?: string; userId?: string },
	db: DB | DBTransaction
): Promise<SelectAdmin | null> {
	const conditions: SQL[] = [];

	if (data.id) {
		conditions.push(eq(admins.id, data.id));
	}

	if (data.userId) {
		conditions.push(eq(admins.userId, data.userId));
	}

	if (conditions.length === 0) {
		return null;
	}

	try {
		const result = await db
			.select()
			.from(admins)
			.where(and(...conditions))
			.limit(1);

		return result[0] ?? null;
	} catch (err) {
		throw new Error(
			`Unable to fetch admin: ${err instanceof Error ? err.message : String(err)}`
		);
	}
}

export async function create(
	data: InsertAdmin,
	db: DB | DBTransaction
): Promise<SelectAdmin | null> {
	try {
		const [newAdmin] = await db.insert(admins).values(data).returning();
		return newAdmin ?? null;
	} catch (_err) {
		throw new Error("Unable to create admin");
	}
}

export async function update(
	data: PatchAdmin & { id: string },
	db: DB | DBTransaction
): Promise<SelectAdmin | null> {
	try {
		const [updatedAdmin] = await db
			.update(admins)
			.set(data)
			.where(eq(admins.id, data.id))
			.returning();

		return updatedAdmin ?? null;
	} catch (_err) {
		throw new Error("Unable to update admin");
	}
}
