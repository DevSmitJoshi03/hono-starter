import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { R2Bucket } from "@cloudflare/workers-types";
import type { Environment } from "@/env";
import { createR2S3Client } from "@/utility/aws-client";
import type { ImageMetadata } from "@/utility/type";

interface R2PresignConfig {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucketName: string;
}

export async function saveImageToR2(
	bucket: R2Bucket | undefined,
	file: File | ArrayBuffer,
	fileName: string,
	folder?: string
): Promise<ImageMetadata> {
	if (!bucket) throw new Error("R2_BUCKET binding is not configured");

	// Generate unique ID for the image
	const uuid = crypto.randomUUID();

	// Construct the full path ID (folder/uuid or just uuid)
	const id = folder ? `${folder}/${uuid}` : uuid;

	// Sanitize fileName to avoid URL encoding issues
	// Keep alphanumeric, dots, dashes, and underscores. Replace others with underscore.
	const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");

	// Upload to R2
	let data: ArrayBuffer;
	if (file instanceof File) {
		data = await file.arrayBuffer();
	} else {
		data = file;
	}

	await bucket.put(id, data);
	return {
		id,
		url: "",
		name: sanitizedFileName,
	};
}

export async function deleteImageFromR2(
	bucket: R2Bucket | undefined,
	imageId: string
): Promise<void> {
	if (!bucket) throw new Error("R2_BUCKET binding is not configured");
	await bucket.delete(imageId);
}

export async function getImagePresignedUrl(
	config: R2PresignConfig,
	imageId: string
): Promise<string> {
	const key = imageId;

	const s3Client = createR2S3Client(config);

	// Create GetObject command
	const command = new GetObjectCommand({
		Bucket: config.bucketName,
		Key: key,
	});

	// Generate presigned URL valid for 30 minutes (1800 seconds)
	const url = await getSignedUrl(s3Client, command, {
		expiresIn: 1800, // 30 minutes in seconds
	});

	return url;
}

export async function getImageMetadataWithUrl(
	config: R2PresignConfig,
	metadata: ImageMetadata
): Promise<ImageMetadata> {
	const url = await getImagePresignedUrl(config, metadata.id);

	return {
		...metadata,
		url,
	};
}

export async function resolveImage(
	env: Environment,
	image: ImageMetadata | null
): Promise<ImageMetadata | null> {
	if (!image) return null;
	return getImageMetadataWithUrl(
		{
			accountId: env.CLOUDFLARE_ACCOUNT_ID,
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
			bucketName: env.R2_BUCKET_NAME,
		},
		image
	);
}

export async function getSignedUrlForDocument(
	config: R2PresignConfig,
	metadata: ImageMetadata,
	expiresIn: number = 86400 // 24 hours in seconds
): Promise<string> {
	const key = metadata.id;

	const s3Client = createR2S3Client(config);

	// Create GetObject command
	const command = new GetObjectCommand({
		Bucket: config.bucketName,
		Key: key,
	});

	// Generate presigned URL with custom expiration
	const url = await getSignedUrl(s3Client, command, {
		expiresIn,
	});

	return url;
}
