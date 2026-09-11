import { S3Client } from "@aws-sdk/client-s3";

export interface R2ClientConfig {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
}
//Creates an AWS S3Client pointed at a Cloudflare R2 account.
export function createR2S3Client(config: R2ClientConfig) {
	return new S3Client({
		region: "auto",
		endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
	});
}
