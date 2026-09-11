import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";
import type { DB } from "@/db";
import type { UserType } from "@/db/schema/user";
import type { Environment } from "@/env";

export interface AppBindings {
	Bindings: Environment;
	Variables: {
		logger: PinoLogger;
		db: DB;
		requestId: string;
		user?: {
			id: string;
			type: UserType;
		};
	};
}

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
	R,
	AppBindings
>;
