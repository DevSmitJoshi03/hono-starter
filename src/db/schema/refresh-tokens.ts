import { relations } from "drizzle-orm";
import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";
import users from "@/db/schema/user";
import { toZodV4SchemaTyped } from "@/lib/zod-utils";

export enum Platform {
	WEB = "web",
	IOS = "ios",
	ANDROID = "android",
	DESKTOP = "desktop",
	ADMIN_DASHBOARD = "admin-dashboard",
	UNKNOWN = "unknown",
}

export const platformEnum = pgEnum("platform", [
	Platform.WEB,
	Platform.IOS,
	Platform.ANDROID,
	Platform.DESKTOP,
	Platform.ADMIN_DASHBOARD,
	Platform.UNKNOWN,
]);

const refreshTokens = pgTable(
	"refresh_tokens",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		// Shared by every token descended from one login. On detected reuse of a
		// rotated token the whole family is revoked.
		familyId: uuid("family_id").notNull().defaultRandom(),
		tokenHash: text("token_hash").notNull(),
		deviceId: text("device_id").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		// Set when this token is consumed by a rotation. A request presenting a
		// token that already has this set is treated as theft.
		rotatedAt: timestamp("rotated_at", { mode: "date", withTimezone: true }),
		userAgent: text("user_agent").notNull(),
		ipAddress: text("ip_address").notNull(),
		platform: platformEnum("platform").notNull(),
		createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => ({
		userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
		familyIdIdx: index("refresh_tokens_family_id_idx").on(table.familyId),
		expiresAtIdx: index("refresh_tokens_expires_at_idx").on(table.expiresAt),
	})
);
export default refreshTokens;

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
	user: one(users, {
		fields: [refreshTokens.userId],
		references: [users.id],
	}),
}));

export const selectRefreshTokensSchema = toZodV4SchemaTyped(
	createSelectSchema(refreshTokens)
);
export const insertRefreshTokensSchema = toZodV4SchemaTyped(
	createInsertSchema(refreshTokens)
		.required({
			userId: true,
			tokenHash: true,
			deviceId: true,
			expiresAt: true,
			userAgent: true,
			ipAddress: true,
		})
		.omit({
			id: true,
			createdAt: true,
			updatedAt: true,
		})
);
// @ts-expect-error partial exists on zod v4 type
export const patchRefreshTokensSchema = insertRefreshTokensSchema.partial();

// Type exports based on Zod schemas
export type SelectRefreshToken = z.infer<typeof selectRefreshTokensSchema>;
export type InsertRefreshToken = z.infer<typeof insertRefreshTokensSchema>;
export type PatchRefreshToken = z.infer<typeof patchRefreshTokensSchema>;
