import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	json,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";
import users from "@/db/schema/user";
import { toZodV4SchemaTyped } from "@/lib/zod-utils";
import type { ImageMetadata } from "@/utility/type";

const customers = pgTable(
	"customers",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		phoneNumber: text("phone_number").notNull(),
		image: json("image").$type<ImageMetadata>(),
		status: boolean("status").notNull().default(true),
		createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => ({
		// customer-auth handlers (me/updateProfile/changePassword) look
		// customers up by userId on every request — this is a hot path.
		userIdIdx: index("customers_user_id_idx").on(table.userId),
	})
);
export default customers;

export const customersRelations = relations(customers, ({ one }) => ({
	users: one(users, {
		fields: [customers.userId],
		references: [users.id],
	}),
}));

export const selectCustomersSchema = toZodV4SchemaTyped(
	createSelectSchema(customers)
);
export const insertCustomersSchema = toZodV4SchemaTyped(
	createInsertSchema(customers)
		.required({
			name: true,
			phoneNumber: true,
			userId: true,
		})
		.omit({
			id: true,
			createdAt: true,
			updatedAt: true,
		})
);
// @ts-expect-error partial exists on zod v4 type
export const patchCustomersSchema = insertCustomersSchema.partial();

// Type exports based on Zod schemas
export type SelectCustomer = z.infer<typeof selectCustomersSchema>;
export type InsertCustomer = z.infer<typeof insertCustomersSchema>;
export type PatchCustomer = z.infer<typeof patchCustomersSchema>;
