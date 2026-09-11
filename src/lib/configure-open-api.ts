import { Scalar } from "@scalar/hono-api-reference";
import type { AppOpenAPI } from "@/lib/types";
import packageJSON from "../../package.json";

export default function configureOpenAPI(app: AppOpenAPI) {
	// Register Bearer security scheme for JWT authentication
	app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
		type: "http",
		scheme: "bearer",
		bearerFormat: "JWT",
		description: "Enter your JWT token from the login endpoint",
	});

	app.doc("/doc", {
		openapi: "3.0.0",
		info: {
			version: packageJSON.version,
			title: "Hono Open API Starter Cloudflare Template",
		},
	});

	app.get(
		"/reference",
		Scalar({
			url: "/doc",
			theme: "kepler",
			layout: "classic",
			defaultHttpClient: {
				targetKey: "js",
				clientKey: "fetch",
			},
			authentication: {
				preferredSecurityScheme: "Bearer",
			},
		})
	);
}
