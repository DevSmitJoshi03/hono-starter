// Builders for the standard API response envelope. These return the plain body
// object; handlers pass the result to `c.json(..., status)` so the typed
// OpenAPI route still validates the shape.
//
//   return c.json(success(data), HttpStatusCodes.OK);
//   return c.json(failure(ErrorCodes.NOT_FOUND, "Not found."), HttpStatusCodes.NOT_FOUND);

import type { PaginationMeta } from "@/utility/pagination-helper";

export type ResponseMeta = {
	pagination?: PaginationMeta;
	unreadCount?: number;
	metrics?: unknown;
};

// Status-based generic error codes. Keep in sync with the HTTP status the
// handler returns alongside the body.
export const ErrorCodes = {
	BAD_REQUEST: "BAD_REQUEST",
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",
	NOT_FOUND: "NOT_FOUND",
	CONFLICT: "CONFLICT",
	VALIDATION_ERROR: "VALIDATION_ERROR",
	TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
	INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes] | string;

export type SuccessResponse<T> = {
	success: true;
	data: T;
	message?: string;
	meta?: ResponseMeta;
};

export type FailureResponse = {
	success: false;
	code: ErrorCode;
	message: string;
	details?: unknown;
};

export function success<T>(
	data: T,
	opts?: { message?: string; meta?: ResponseMeta }
): SuccessResponse<T> {
	return {
		success: true as const,
		data,
		...(opts?.message !== undefined ? { message: opts.message } : {}),
		...(opts?.meta !== undefined ? { meta: opts.meta } : {}),
	} as SuccessResponse<T>;
}

export function failure(
	code: ErrorCode,
	message: string,
	details?: unknown
): FailureResponse {
	return {
		success: false as const,
		code,
		message,
		...(details !== undefined ? { details } : {}),
	} as FailureResponse;
}

const STATUS_CODE_MAP: Record<number, ErrorCode> = {
	400: ErrorCodes.BAD_REQUEST,
	401: ErrorCodes.UNAUTHORIZED,
	403: ErrorCodes.FORBIDDEN,
	404: ErrorCodes.NOT_FOUND,
	409: ErrorCodes.CONFLICT,
	422: ErrorCodes.VALIDATION_ERROR,
	429: ErrorCodes.TOO_MANY_REQUESTS,
	500: ErrorCodes.INTERNAL_ERROR,
};

// For error returns where the HTTP status is dynamic (e.g. a guard helper that
// returns its own status). Derives a generic code from the status.
export function failureForStatus(
	status: number,
	message: string,
	details?: unknown
) {
	return failure(
		STATUS_CODE_MAP[status] ?? ErrorCodes.INTERNAL_ERROR,
		message,
		details
	);
}
