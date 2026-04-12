import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.MICROSOFT_CLIENT_ID || "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || "";
  const tenantId = process.env.MICROSOFT_TENANT_ID || "";
  const nextauthUrl = process.env.NEXTAUTH_URL || "";
  const nextauthSecret = process.env.NEXTAUTH_SECRET || "";

  // Check for whitespace issues in env vars
  const envIssues: string[] = [];
  if (clientId !== clientId.trim()) envIssues.push("MICROSOFT_CLIENT_ID has whitespace");
  if (clientSecret !== clientSecret.trim()) envIssues.push("MICROSOFT_CLIENT_SECRET has whitespace");
  if (nextauthUrl !== nextauthUrl.trim()) envIssues.push("NEXTAUTH_URL has whitespace");
  if (nextauthSecret !== nextauthSecret.trim()) envIssues.push("NEXTAUTH_SECRET has whitespace");

  // Test token endpoint is reachable
  let tokenEndpointTest = "not tested";
  try {
    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
    });
    const data = await res.json();
    if (res.ok) {
      tokenEndpointTest = "OK — client_id and client_secret are valid";
    } else {
      tokenEndpointTest = `FAILED (${res.status}): ${data.error} — ${data.error_description || "no description"}`;
    }
  } catch (err: unknown) {
    tokenEndpointTest = `Network error: ${err instanceof Error ? err.message : "unknown"}`;
  }

  return NextResponse.json({
    env: {
      MICROSOFT_CLIENT_ID: clientId || "MISSING",
      MICROSOFT_CLIENT_SECRET_set: !!clientSecret,
      MICROSOFT_CLIENT_SECRET_prefix: clientSecret ? clientSecret.substring(0, 4) : "N/A",
      MICROSOFT_CLIENT_SECRET_length: clientSecret.length,
      MICROSOFT_TENANT_ID: tenantId || "MISSING",
      NEXTAUTH_URL: nextauthUrl || "MISSING",
      NEXTAUTH_SECRET_set: !!nextauthSecret,
      NEXTAUTH_SECRET_length: nextauthSecret.length,
      NODE_ENV: process.env.NODE_ENV || "unknown",
    },
    envIssues: envIssues.length > 0 ? envIssues : "none",
    expectedCallbackUrl: `${nextauthUrl}/api/auth/callback/microsoft`,
    tokenEndpointTest,
  });
}
