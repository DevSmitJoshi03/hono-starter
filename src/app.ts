import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import adminAuth from "@/routes/admin-auth/admin-auth.index";
import auth from "@/routes/auth/auth.index";
import customerAuth from "@/routes/customer-auth/customer-auth.index";
import index from "@/routes/index.route";

const app = createApp();

configureOpenAPI(app);

const routes = [index, auth, adminAuth, customerAuth] as const;

routes.forEach((route) => {
	app.route("/", route);
});

export type AppType = (typeof routes)[number];

export default app;
