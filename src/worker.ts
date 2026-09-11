// Wrangler entrypoint (wrangler.jsonc `main`). Kept separate from src/app.ts
// so app.ts can stay a plain Hono app — that's what tests (`app.request(...)`)
// and the Node entrypoint (src/index.ts) import; only the deployed Worker
// itself needs the combined fetch + scheduled export shape below.
import app from "@/app";
import pruneStaleAuthRecords from "@/scheduled/prune-stale-auth-records";

export default {
	fetch: app.fetch,
	scheduled: pruneStaleAuthRecords,
};

export type { AppType } from "@/app";
