import type { SendEmail } from "@cloudflare/workers-types";

// The @cloudflare/workers-types SendEmail still reflects the old Email Routing API.
// The new Email Sending service (send_email binding) accepts EmailMessageBuilder directly.
// These local types match the shape documented at:
// https://developers.cloudflare.com/email-service/api/send-emails/workers-api/

export interface EmailAddress {
	email: string;
	name?: string;
}

export type EmailRecipient = string | EmailAddress | (string | EmailAddress)[];

export interface EmailAttachment {
	/** Base64-encoded string or binary buffer */
	content: string | ArrayBuffer | ArrayBufferView;
	filename: string;
	/** MIME type, e.g. "application/pdf" */
	type: string;
	disposition: "attachment" | "inline";
	/** Required when disposition is "inline" for cid: references */
	contentId?: string;
}

interface EmailMessageBuilder {
	to: EmailRecipient;
	from: string | EmailAddress;
	subject: string;
	html?: string;
	text?: string;
	cc?: EmailRecipient;
	bcc?: EmailRecipient;
	replyTo?: string | EmailAddress;
	attachments?: EmailAttachment[];
	headers?: Record<string, string>;
}

interface EmailSendResult {
	messageId: string;
}

type EmailSendBinding = {
	send(message: EmailMessageBuilder): Promise<EmailSendResult>;
};

export interface SendEmailOptions {
	to: EmailRecipient;
	// No hardcoded default here on purpose — callers build this from
	// env.EMAIL_FROM_ADDRESS / env.BRAND_NAME (src/env.ts) so rebranding is a
	// config change, not a code change.
	from: string | EmailAddress;
	subject: string;
	/** HTML body — at least one of html or text is required. */
	html?: string;
	/** Plain-text fallback body. */
	text?: string;
	cc?: EmailRecipient;
	bcc?: EmailRecipient;
	replyTo?: string | EmailAddress;
	attachments?: EmailAttachment[];
	headers?: Record<string, string>;
}

export interface EmailResult {
	messageId: string;
}

export class EmailSendError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "EmailSendError";
		this.code = code;
	}
}

export async function sendEmail(
	binding: SendEmail,
	options: SendEmailOptions
): Promise<EmailResult> {
	const sendBinding = binding as unknown as EmailSendBinding;

	const message: EmailMessageBuilder = {
		to: options.to,
		from: options.from,
		subject: options.subject,
	};

	if (options.html) message.html = options.html;
	if (options.text) message.text = options.text;
	if (options.cc) message.cc = options.cc;
	if (options.bcc) message.bcc = options.bcc;
	if (options.replyTo) message.replyTo = options.replyTo;
	if (options.attachments?.length) message.attachments = options.attachments;
	if (options.headers) message.headers = options.headers;

	try {
		return await sendBinding.send(message);
	} catch (error) {
		const code =
			error instanceof Error && "code" in error
				? String((error as { code: unknown }).code)
				: "E_UNKNOWN";
		throw new EmailSendError(
			code,
			error instanceof Error ? error.message : "Failed to send email"
		);
	}
}
