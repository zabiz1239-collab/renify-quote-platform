import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function GET() {
  // Log env vars (redacted) to verify they're loaded
  const smtpHost = process.env.SMTP_HOST || "(not set)";
  const smtpPort = process.env.SMTP_PORT || "(not set)";
  const smtpUser = process.env.SMTP_USER || "(not set)";
  const smtpPass = process.env.SMTP_PASS ? `***${process.env.SMTP_PASS.slice(-3)}` : "(not set)";

  const envInfo = { smtpHost, smtpPort, smtpUser, smtpPass };

  try {
    await sendEmail({
      to: ["zabi@renify.com.au"],
      subject: "Renify SMTP Test from Vercel",
      htmlBody: "<p>This is a test email sent from the Vercel production deployment.</p><p>If you received this, SMTP is working.</p>",
    });

    return NextResponse.json({ success: true, env: envInfo, message: "Email sent successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    const code = (err as { code?: string }).code;
    const command = (err as { command?: string }).command;
    const responseCode = (err as { responseCode?: number }).responseCode;

    return NextResponse.json({
      success: false,
      env: envInfo,
      error: msg,
      code,
      command,
      responseCode,
      stack: stack?.split("\n").slice(0, 5),
    });
  }
}
