import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";
import { toZodV4SchemaTyped } from "@/lib/zod-utils";

const verifications = pgTable(
	"verifications",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		attempts: integer("attempts").notNull().default(0),
		expiresAt: timestamp("expires_at", {
			mode: "date",
			withTimezone: true,
		}).notNull(),
		createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => ({
		// Every OTP step (forgot-password, verify-otp, reset-password) looks
		// this up by identifier — this is a hot path.
		identifierIdx: index("verifications_identifier_idx").on(table.identifier),
	})
);
export default verifications;

export const selectVerificationsSchema = toZodV4SchemaTyped(
	createSelectSchema(verifications)
);
export const insertVerificationsSchema = toZodV4SchemaTyped(
	createInsertSchema(verifications)
		.required({
			identifier: true,
			value: true,
			expiresAt: true,
		})
		.omit({
			id: true,
			createdAt: true,
			updatedAt: true,
		})
);
// @ts-expect-error partial exists on zod v4 type
export const patchVerificationsSchema = insertVerificationsSchema.partial();

// Type exports based on Zod schemas
export type SelectVerification = z.infer<typeof selectVerificationsSchema>;
export type InsertVerification = z.infer<typeof insertVerificationsSchema>;
export type PatchVerification = z.infer<typeof patchVerificationsSchema>;
