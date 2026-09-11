import { createRouter } from "@/lib/create-app";
import * as handlers from "@/routes/customer-auth/customer-auth.handlers";
import * as routes from "@/routes/customer-auth/customer-auth.routes";

const router = createRouter()
	.openapi(routes.register, handlers.register)
	.openapi(routes.login, handlers.login)
	.openapi(routes.me, handlers.me)
	.openapi(routes.updateProfile, handlers.updateProfile)
	.openapi(routes.changePassword, handlers.changePassword);

export default router;
