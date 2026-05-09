import sgMail from "@sendgrid/mail";
import { sendgridApiKey } from "./config";

interface EmailParams {
  to: string;
  subject: string;
  photographerName: string;
  photographerEmail: string;
  logoUrl: string | null;
  accentColor: string;
  heading: string;
  body: string;
  ctaText: string | null;
  ctaUrl: string | null;
}

function buildHtml(params: EmailParams): string {
  const logo = params.logoUrl
    ? `<img src="${params.logoUrl}" alt="${params.photographerName}" style="max-height:40px;margin-bottom:12px;" /><br/>`
    : "";

  const cta =
    params.ctaText && params.ctaUrl
      ? `<p style="margin:24px 0;"><a href="${params.ctaUrl}" style="background-color:${params.accentColor};color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">${params.ctaText}</a></p>`
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:100%;">
<tr><td style="padding:24px 32px;border-bottom:1px solid #e5e5e5;">
${logo}<span style="font-size:16px;font-weight:600;color:#111;">${params.photographerName}</span>
</td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 16px;font-size:22px;color:#111;">${params.heading}</h1>
<p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.6;">${params.body}</p>
${cta}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #e5e5e5;text-align:center;">
<span style="font-size:12px;color:#999;">${params.photographerName}</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendAgentEmail(params: EmailParams): Promise<void> {
  sgMail.setApiKey(sendgridApiKey.value());
  try {
    await sgMail.send({
      to: params.to,
      from: { name: params.photographerName, email: "noreply@shotready.com" },
      replyTo: params.photographerEmail,
      subject: params.subject,
      html: buildHtml(params),
    });
    console.log(`Email sent to ${params.to}: ${params.subject}`);
  } catch (err) {
    console.error(`Failed to send email to ${params.to}:`, err);
  }
}
