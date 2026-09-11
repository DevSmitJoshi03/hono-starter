/** biome-ignore-all lint/suspicious/noConsole: CLI script output */
/**
 * Creates the first (or an additional) admin account directly against the
 * database. There is no admin-registration HTTP endpoint by design — only an
 * existing admin should be able to mint another one — so this script is the
 * bootstrap path for the very first admin.
 *
 * Usage:
 *   bun run create-admin -- --email=you@example.com --password=xxxxxxxx \
 *     [--name="Jane Doe"] [--phone=+919876543210] [--address="123 Main St"] \
 *     [--super=false]
 */
import path from "node:path";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { createDb } from "@/db";
import * as adminQueries from "@/db/queries/admin";
import * as usersQueries from "@/db/queries/user";
import { UserType } from "@/db/schema/user";
import { AdminModule } from "@/middlewares/auth";
import { hashPassword } from "@/utility/password";

expand(
	config({
		path: path.resolve(
			process.cwd(),
			// biome-ignore lint/style/noProcessEnv: Accessing process.env is required here
			process.env.NODE_ENV === "test" ? ".env.test" : ".env"
		),
	})
);

// biome-ignore lint/style/noProcessEnv: Accessing process.env is required here
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error("DATABASE_URL environment variable is not set");
}

function arg(name: string): string | undefined {
	const prefix = `--${name}=`;
	const found = process.argv.find((a) => a.startsWith(prefix));
	return found?.slice(prefix.length);
}

async function main() {
	const email = arg("email");
	const password = arg("password");
	const name = arg("name") ?? "Admin";
	const phoneNumber = arg("phone") ?? "0000000000";
	const address = arg("address") ?? "N/A";
	const isSuperAdmin = arg("super") !== "false";

	if (!email || !password) {
		console.error(
			'Usage: bun run create-admin -- --email=you@example.com --password=xxxxxxxx [--name="Jane Doe"] [--phone=+919876543210] [--address="..."] [--super=false]'
		);
		process.exit(1);
	}

	if (password.length < 8) {
		console.error("❌ Password must be at least 8 characters.");
		process.exit(1);
	}

	const { db, client } = createDb({ DATABASE_URL: databaseUrl });

	try {
		const existing = await usersQueries.findOne(
			{ email, type: UserType.ADMIN },
			db
		);
		if (existing) {
			console.error(`❌ An admin with email "${email}" already exists.`);
			process.exit(1);
		}

		const hashedPassword = await hashPassword(password);

		const admin = await db.transaction(async (tx) => {
			const user = await usersQueries.create(
				{ email, password: hashedPassword, type: UserType.ADMIN },
				tx
			);
			if (!user) throw new Error("Failed to create user");

			const created = await adminQueries.create(
				{
					userId: user.id,
					name,
					phoneNumber,
					address,
					isSuperAdmin,
					// Super admins bypass the permission check entirely (see
					// requirePermission in src/middlewares/auth.ts); listing every
					// module here keeps the row meaningful if isSuperAdmin is later
					// flipped off for this account.
					permission: Object.values(AdminModule),
				},
				tx
			);
			if (!created) throw new Error("Failed to create admin profile");

			return created;
		});

		console.log(
			`✅ Admin created: ${email} (id: ${admin.id}, isSuperAdmin: ${isSuperAdmin})`
		);
	} finally {
		await client.end();
	}
}

main().catch((error) => {
	console.error("❌ Failed to create admin:", error);
	process.exit(1);
});
