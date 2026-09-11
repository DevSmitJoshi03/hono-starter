import { createRouter } from "@/lib/create-app";
import * as handlers from "@/routes/admin-auth/admin-auth.handlers";
import * as routes from "@/routes/admin-auth/admin-auth.routes";

const router = createRouter().openapi(routes.login, handlers.login);

export default router;
