// src/middlewares/securityMiddleware.ts
import type { MiddlewareHandler } from "hono";
import { NONCE, secureHeaders } from "hono/secure-headers";

// Strict CSP for most routes
const strictSecurityMiddleware = secureHeaders({
	// 🚫 Prevent clickjacking
	xFrameOptions: "DENY",

	// 🧪 Prevent MIME sniffing
	xContentTypeOptions: "nosniff",

	// 🔒 Enforce HTTPS (VERY important in prod)
	strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",

	// 🕵️ Do not leak referrer info
	referrerPolicy: "no-referrer",

	// 🧠 Isolate browsing context (mitigates XS-Leaks)
	crossOriginOpenerPolicy: "same-origin",
	crossOriginResourcePolicy: "same-origin",

	// 🧯 Disable old XSS auditor (modern browsers)
	xXssProtection: "0",

	// 🚫 Block Flash / PDF cross-domain access
	xPermittedCrossDomainPolicies: "none",

	// 🔐 Lock down browser features
	permissionsPolicy: {
		camera: [],
		microphone: [],
		geolocation: [],
		payment: [],
		usb: [],
		magnetometer: [],
		gyroscope: [],
		fullscreen: ["self"],
	},

	// 🛡️ STRONG Content Security Policy
	contentSecurityPolicy: {
		defaultSrc: ["'self'"],
		scriptSrc: [
			"'self'",
			NONCE, // ✅ per-request nonce
		],
		styleSrc: ["'self'", NONCE],
		imgSrc: ["'self'", "data:"],
		fontSrc: ["'self'"],
		connectSrc: ["'self'"],
		frameAncestors: ["'none'"],
		baseUri: ["'self'"],
		formAction: ["'self'"],
		objectSrc: ["'none'"],
		upgradeInsecureRequests: [],
	},
});

// Relaxed CSP for API documentation routes (Scalar needs external scripts and inline styles)
const relaxedSecurityMiddleware = secureHeaders({
	xFrameOptions: "DENY",
	xContentTypeOptions: "nosniff",
	strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
	referrerPolicy: "no-referrer",
	crossOriginOpenerPolicy: "same-origin",
	crossOriginResourcePolicy: "same-origin",
	xXssProtection: "0",
	xPermittedCrossDomainPolicies: "none",
	permissionsPolicy: {
		camera: [],
		microphone: [],
		geolocation: [],
		payment: [],
		usb: [],
		magnetometer: [],
		gyroscope: [],
		fullscreen: ["self"],
	},
	contentSecurityPolicy: {
		defaultSrc: ["'self'"],
		scriptSrc: [
			"'self'",
			// Note: NONCE is removed here because it overrides 'unsafe-inline'
			"https://cdn.jsdelivr.net", // ✅ Allow Scalar CDN
			"'unsafe-inline'", // ⚠️ Required for Scalar's inline scripts
		],
		styleSrc: [
			"'self'",
			// Note: NONCE is removed here because it overrides 'unsafe-inline'
			"https://cdn.jsdelivr.net", // ✅ Allow Scalar CDN
			"'unsafe-inline'", // ⚠️ Required for Scalar's inline styles
		],
		imgSrc: ["'self'", "data:", "https:"], // Allow external images in docs
		fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
		connectSrc: ["'self'", "https://cdn.jsdelivr.net"], // ✅ Allow source maps and API calls
		frameAncestors: ["'none'"],
		baseUri: ["'self'"],
		formAction: ["'self'"],
		objectSrc: ["'none'"],
		upgradeInsecureRequests: [],
	},
});

// Conditional middleware that applies different CSP based on route
export const securityMiddleware: MiddlewareHandler = (c, next) => {
	const path = c.req.path;

	// Use relaxed CSP for API documentation routes
	if (path === "/reference" || path === "/doc") {
		return relaxedSecurityMiddleware(c, next);
	}

	// Use strict CSP for all other routes
	return strictSecurityMiddleware(c, next);
};
