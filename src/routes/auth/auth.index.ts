import { createRouter } from "@/lib/create-app";
import * as handlers from "@/routes/auth/auth.handlers";
import * as routes from "@/routes/auth/auth.routes";

const router = createRouter()
	.openapi(routes.refreshToken, handlers.refreshToken)
	.openapi(routes.logout, handlers.logout)
	.openapi(routes.forgotPassword, handlers.forgotPassword)
	.openapi(routes.verifyOtp, handlers.verifyOtp)
	.openapi(routes.resetPassword, handlers.resetPassword);

export default router;
