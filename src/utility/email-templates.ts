// Design tokens that aren't part of brand identity — just a clean default
// look. The two things that actually vary per deployment (accent color, logo)
// come in through EmailBrand below, sourced from env (see src/env.ts).
const PAGE_BG = "#f4f4f5";
const TEXT = "#1f1f1f";
const TEXT_MUTED = "#585858";
const TEXT_FAINT = "#8a8a8a";
const HAIRLINE = "#e4e4e7";
const HEADING_DARK = "#0a0a0a";

export interface EmailBrand {
	/** From env.BRAND_NAME. */
	name: string;
	/** From env.SITE_URL — used for the CTA button and Privacy/Terms links. */
	siteUrl: string;
	/** From env.BRAND_ACCENT_COLOR (hex). Used for the header rule, OTP box, links. */
	accentColor: string;
	/** From env.LOGO_URL. When unset, the header falls back to a text wordmark. */
	logoUrl?: string;
}

// Appends an alpha channel to accentColor for a soft highlight background.
// Assumes a 6-digit hex color (the BRAND_ACCENT_COLOR default and format).
function highlight(text: string, brand: EmailBrand): string {
	return `<span style="background:${brand.accentColor}1a;padding:1px 4px;border-radius:3px">${text}</span>`;
}

function headerMark(brand: EmailBrand): string {
	if (brand.logoUrl) {
		return `<img src="${brand.logoUrl}" alt="${brand.name}" width="150" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0" />`;
	}
	return `<span style="font-size:20px;font-weight:800;color:${HEADING_DARK}">${brand.name}</span>`;
}

function layout(title: string, body: string, brand: EmailBrand): string {
	const year = new Date().getFullYear();
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:'Helvetica Neue',Arial,sans-serif;color:${TEXT}">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${PAGE_BG};padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;max-width:600px;background:#ffffff">
        <!-- header -->
        <tr>
          <td style="padding:38px 48px 22px;text-align:center;border-bottom:2px solid ${brand.accentColor}">
            ${headerMark(brand)}
          </td>
        </tr>
        <!-- body -->
        <tr><td style="padding:34px 48px 40px">${body}</td></tr>
        <!-- footer -->
        <tr>
          <td style="padding:22px 48px 34px;text-align:center;border-top:1px solid ${HAIRLINE}">
            <p style="margin:0 0 10px;font-size:13px">
              <a href="${brand.siteUrl}/privacy" style="color:${brand.accentColor};text-decoration:none">Privacy Policy</a>
              <span style="color:${TEXT_FAINT}">&nbsp;&middot;&nbsp;</span>
              <a href="${brand.siteUrl}/terms" style="color:${brand.accentColor};text-decoration:none">Terms &amp; Conditions</a>
            </p>
            <p style="margin:0;font-size:12px;color:${TEXT_FAINT}">Copyright &copy; ${year} ${brand.name}. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Shared by every account type (admin, customer) that goes through the
 * forgot-password flow in src/routes/auth/auth.handlers.ts — keep the copy
 * generic rather than naming a specific role.
 *
 * `brand` comes from env (BRAND_NAME / SITE_URL / LOGO_URL /
 * BRAND_ACCENT_COLOR) — configure it there, not by editing this template.
 */
export function otpEmailHtml(
	otp: string,
	brand: EmailBrand,
	expiresInMinutes = 10
): string {
	return layout(
		`Your verification code — ${brand.name}`,
		`
    <h1 style="margin:0 0 22px;font-size:22px;font-weight:700;color:${TEXT};text-align:center">Verify your email</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEXT}">Hi there,</p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${TEXT_MUTED}">
      Use the code below to complete your ${highlight(brand.name, brand)} verification.
      It expires in <strong>${expiresInMinutes} minutes</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center" style="padding:28px 0 24px">
        <div style="display:inline-block;padding:22px 40px;border:2px solid ${brand.accentColor};border-radius:12px;background:${PAGE_BG};font-size:36px;font-weight:800;letter-spacing:16px;color:${HEADING_DARK}">${otp}</div>
      </td></tr>
    </table>
    <p style="margin:0 0 26px;font-size:13px;line-height:1.6;color:${TEXT_FAINT};text-align:center">
      If you didn&rsquo;t request this, you can safely ignore this email.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td style="padding:14px 18px;background:${PAGE_BG};border-left:4px solid ${brand.accentColor};border-radius:2px">
        <p style="margin:0;font-size:13px;line-height:1.6;color:${TEXT_MUTED}">
          <strong style="color:${TEXT}">Security Notice:</strong> Never share this code with anyone.
          ${highlight(brand.name, brand)} will never ask for it.
        </p>
      </td></tr>
    </table>
  `,
		brand
	);
}
