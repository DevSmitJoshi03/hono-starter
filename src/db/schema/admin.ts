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

const admins = pgTable(
	"admins",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		phoneNumber: text("phone_number").notNull(),
		address: text("address").notNull(),
		isSuperAdmin: boolean("is_super_admin").notNull().default(false),
		permission: json("permission").$type<string[]>().notNull(),
		createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => ({
		// requirePermission (src/middlewares/auth.ts) looks admins up by userId
		// on every permission-gated request — this is a hot path.
		userIdIdx: index("admins_user_id_idx").on(table.userId),
	})
);
export default admins;

export const adminsRelations = relations(admins, ({ one }) => ({
	users: one(users, {
		fields: [admins.userId],
		references: [users.id],
	}),
}));

export const selectAdminsSchema = toZodV4SchemaTyped(
	createSelectSchema(admins)
);
export const insertAdminsSchema = toZodV4SchemaTyped(
	createInsertSchema(admins)
		.required({
			name: true,
			phoneNumber: true,
			userId: true,
			address: true,
			permission: true,
		})
		.omit({
			id: true,
			createdAt: true,
			updatedAt: true,
		})
);
// @ts-expect-error partial exists on zod v4 type
export const patchAdminsSchema = insertAdminsSchema.partial();

// Type exports based on Zod schemas
export type SelectAdmin = z.infer<typeof selectAdminsSchema>;
export type InsertAdmin = z.infer<typeof insertAdminsSchema>;
export type PatchAdmin = z.infer<typeof patchAdminsSchema>;
