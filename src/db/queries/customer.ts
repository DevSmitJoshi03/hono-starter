import type { SQL } from "drizzle-orm";
import { and, eq } from "drizzle-orm";

import type { DB, DBTransaction } from "@/db/index";
import customers, {
	type InsertCustomer,
	type SelectCustomer,
} from "@/db/schema/customer";

export async function findOne(
	data: { id?: string; userId?: string },
	db: DB | DBTransaction
): Promise<SelectCustomer | null> {
	const conditions: SQL[] = [];

	if (data.id) {
		conditions.push(eq(customers.id, data.id));
	}

	if (data.userId) {
		conditions.push(eq(customers.userId, data.userId));
	}

	if (conditions.length === 0) {
		return null;
	}

	try {
		const result = await db
			.select()
			.from(customers)
			.where(and(...conditions))
			.limit(1);

		return result[0] ?? null;
	} catch (err) {
		throw new Error(
			`Unable to fetch customer: ${err instanceof Error ? err.message : String(err)}`
		);
	}
}

export async function create(
	data: InsertCustomer,
	db: DB | DBTransaction
): Promise<SelectCustomer | null> {
	try {
		const [newCustomer] = await db.insert(customers).values(data).returning();
		return newCustomer ?? null;
	} catch (_err) {
		throw new Error("Unable to create customer");
	}
}

export async function update(
	id: string,
	data: Partial<Pick<SelectCustomer, "name" | "phoneNumber" | "image">>,
	db: DB | DBTransaction
): Promise<SelectCustomer | null> {
	try {
		const [updated] = await db
			.update(customers)
			.set(data)
			.where(eq(customers.id, id))
			.returning();
		return updated ?? null;
	} catch (err) {
		throw new Error(
			`Unable to update customer: ${err instanceof Error ? err.message : String(err)}`
		);
	}
}
