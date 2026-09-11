import { Pool as NeonPool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import {
	type NodePgDatabase,
	drizzle as pgDrizzle,
} from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";

// Minimal surface of the CF Hyperdrive binding we actually depend on.
// Avoids pulling in the full @cloudflare/workers-types global namespace.
export interface HyperdriveBinding {
	readonly connectionString: string;
}

type DbEnv = {
	HYPERDRIVE?: HyperdriveBinding;
	DATABASE_URL?: string;
};

// NodePgDatabase is the canonical exported type.
// Both adapters expose identical Drizzle query APIs; the Neon instance is
// cast to this type so callers never see an implementation-level union.
export type DB = NodePgDatabase<typeof schema>;
export type DBTransaction = Parameters<Parameters<DB["transaction"]>[0]>[0];

export async function ping(db: DB): Promise<void> {
	await db.execute(sql`SELECT 1`);
}

export function createDb(env: DbEnv): { db: DB; client: PgPool | NeonPool } {
	if (env.HYPERDRIVE) {
		// Hyperdrive manages the real connection pool at CF's edge.
		// Creating a thin PgPool wrapper per request is intentional — it's cheap.
		const client = new PgPool({
			connectionString: env.HYPERDRIVE.connectionString,
		});
		return { db: pgDrizzle(client, { schema, casing: "snake_case" }), client };
	}

	// Neon serverless uses HTTP/WebSocket transport — no persistent TCP socket.
	if (!env.DATABASE_URL) {
		throw new Error(
			"DATABASE_URL is required when HYPERDRIVE binding is not set"
		);
	}
	const client = new NeonPool({ connectionString: env.DATABASE_URL });
	return {
		db: neonDrizzle(client, { schema, casing: "snake_case" }) as unknown as DB,
		client,
	};
}
