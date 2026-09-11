import { serve } from "@hono/node-server";
import app from "@/app";
import env from "@/env-runtime";

serve({
	fetch: app.fetch,
	port: env.PORT,
});

// biome-ignore lint/suspicious/noConsole: startup log for the Node entrypoint
console.log(`Server listening on http://localhost:${env.PORT}`);
