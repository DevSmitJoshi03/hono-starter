import type { SQL } from "drizzle-orm";
import { and, desc, eq, ilike, sql } from "drizzle-orm";

import type { DB, DBTransaction } from "@/db/index";
import users, {
	type InsertUser,
	type PatchUser,
	type SelectUser,
} from "@/db/schema/user";

export async function findOne(
	data: { id?: string; email?: string; type?: string },
	db: DB | DBTransaction
): Promise<SelectUser | null> {
	const conditions: SQL[] = [];

	if (data.id) {
		conditions.push(eq(users.id, data.id));
	}

	if (data.email) {
		conditions.push(eq(users.email, data.email));
	}

	if (data.type) {
		conditions.push(eq(users.type, data.type));
	}

	if (conditions.length === 0) {
		return null;
	}

	try {
		const result = await db
			.select()
			.from(users)
			.where(and(...conditions))
			.limit(1);

		return result[0] ?? null;
	} catch (err) {
		throw new Error(
			`Unable to fetch user: ${err instanceof Error ? err.message : String(err)}`
		);
	}
}

export async function create(
	data: InsertUser,
	db: DB | DBTransaction
): Promise<SelectUser | null> {
	try {
		const [newUser] = await db.insert(users).values(data).returning();
		return newUser ?? null;
	} catch (_err) {
		throw new Error("Unable to create user");
	}
}

export async function update(
	data: PatchUser,
	db: DB | DBTransaction
): Promise<SelectUser | null> {
	try {
		const [updatedUser] = await db
			.update(users)
			.set(data)
			.where(eq(users.id, data.id))
			.returning();

		return updatedUser ?? null;
	} catch (_err) {
		throw new Error("Unable to update user");
	}
}

export async function remove(
	data: { id: string },
	db: DB | DBTransaction
): Promise<SelectUser | null> {
	try {
		const [deletedUser] = await db
			.delete(users)
			.where(eq(users.id, data.id))
			.returning();

		return deletedUser ?? null;
	} catch (_err) {
		throw new Error("Unable to delete user");
	}
}

export async function updatePassword(
	data: { id: string; password: string },
	db: DB | DBTransaction
): Promise<SelectUser | null> {
	try {
		const [updatedUser] = await db
			.update(users)
			.set({ password: data.password })
			.where(eq(users.id, data.id))
			.returning();

		return updatedUser ?? null;
	} catch (_err) {
		throw new Error("Unable to update user password");
	}
}

export async function findAll(db: DB | DBTransaction) {
	const conditions: SQL[] = [];

	const usersResult = await db
		.select({
			id: users.id,
			email: users.email,
			createdAt: users.createdAt,
			totalCount: sql<number>`COUNT(*) OVER()`,
		})
		.from(users)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(desc(users.createdAt));

	const totalCount = usersResult[0]?.totalCount || 0;

	return { data: usersResult, totalCount };
}

export async function findAllWithPagination(
	data: { skip: number; limit: number; searchQuery?: string },
	db: DB | DBTransaction
) {
	const conditions: SQL[] = [];

	if (data.searchQuery?.trim()) {
		conditions.push(ilike(users.email, `%${data.searchQuery.trim()}%`));
	}

	const query = db
		.select({
			id: users.id,
			email: users.email,
			createdAt: users.createdAt,
			updatedAt: users.updatedAt,
			totalCount: sql<number>`COUNT(*) OVER()`,
		})
		.from(users)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(desc(users.createdAt))
		.offset(data.skip)
		.limit(data.limit);

	const usersResult = await query;
	const totalCount = usersResult[0]?.totalCount || 0;

	return { data: usersResult, totalCount };
}
