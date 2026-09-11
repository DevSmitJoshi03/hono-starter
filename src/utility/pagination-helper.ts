export interface PaginationParams {
	page: number;
	limit: number;
	skip: number;
}

export interface PaginationMeta {
	totalCount: number;
	totalPages: number;
	currentPage: number;
	limit: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}

export function getPaginationParams(
	page?: number,
	limit?: number
): PaginationParams {
	const validPage = Math.max(1, Math.floor(page ?? 1));
	const validLimit = Math.max(1, Math.min(100, Math.floor(limit ?? 10)));

	const skip = (validPage - 1) * validLimit;

	return {
		page: validPage,
		limit: validLimit,
		skip,
	};
}

export function getPaginationMeta(
	totalCount: number,
	page: number,
	limit: number
): PaginationMeta {
	const totalPages = Math.max(1, Math.ceil(totalCount / limit));

	const currentPage = Math.min(page, totalPages);

	return {
		totalCount,
		totalPages,
		currentPage,
		limit,
		hasNextPage: currentPage < totalPages,
		hasPreviousPage: currentPage > 1,
	};
}
