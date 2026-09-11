import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";
import admins from "@/db/schema/admin";
import customers from "@/db/schema/customer";
import refreshTokens from "@/db/schema/refresh-tokens";
import { toZodV4SchemaTyped } from "@/lib/zod-utils";

export const UserType = {
	ADMIN: "admin",
	CUSTOMER: "customer",
} as const;

export type UserType = (typeof UserType)[keyof typeof UserType];

const users = pgTable(
	"users",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		email: text("email").notNull(),
		password: text("password").notNull(),
		type: text("type").notNull(),
		createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [unique("users_email_type_unique").on(table.email, table.type)]
);
export default users;

export const usersRelations = relations(users, ({ many }) => ({
	refreshTokens: many(refreshTokens),
	customers: many(customers),
	admins: many(admins),
}));

export const selectUsersSchema = toZodV4SchemaTyped(createSelectSchema(users));
export const insertUsersSchema = toZodV4SchemaTyped(
	createInsertSchema(users, {
		email: (field) => field.email(),
	})
		.required({
			email: true,
			password: true,
			type: true,
		})
		.omit({
			id: true,
			createdAt: true,
			updatedAt: true,
		})
);
// @ts-expect-error partial exists on zod v4 type
export const patchUsersSchema = insertUsersSchema.partial();

// Type exports based on Zod schemas
export type SelectUser = z.infer<typeof selectUsersSchema>;
export type InsertUser = z.infer<typeof insertUsersSchema>;
export type PatchUser = z.infer<typeof patchUsersSchema>;
