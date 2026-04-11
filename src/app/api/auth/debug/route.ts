import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.MICROSOFT_CLIENT_ID || "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || "";
  const tenantId = process.env.MICROSOFT_TENANT_ID || "";
  const nextauthUrl = process.env.NEXTAUTH_URL || "";
  const nextauthSecret = process.env.NEXTAUTH_SECRET || "";

  // Test the token endpoint directly
  let tokenTestResult = "not tested";
  let tokenTestError = "";

  try {
    const wellKnownRes = await fetch(
      "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration"
    );
    const wellKnown = await wellKnownRes.json();
    tokenTestResult = `Well-known OK. Token endpoint: ${wellKnown.token_endpoint}`;
  } catch (err: unknown) {
    tokenTestError = err instanceof Error ? err.message : "Unknown error";
  }

  // Test client credentials (without actually getting a token - just validate the request format)
  let credentialTest = "not tested";
  try {
    const testRes = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
          scope: "https://graph.microsoft.com/.default",
        }),
      }
    );
    const testData = await testRes.json();
    if (testRes.ok) {
      credentialTest = "Client credentials valid - token obtained successfully";
    } else {
      credentialTest = `FAILED (${testRes.status}): ${testData.error} - ${testData.error_description}`;
    }
  } catch (err: unknown) {
    credentialTest = `Error: ${err instanceof Error ? err.message : "Unknown"}`;
  }

  return NextResponse.json({
    env: {
      MICROSOFT_CLIENT_ID: clientId ? `${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 4)} (len=${clientId.length})` : "MISSING",
      MICROSOFT_CLIENT_SECRET: clientSecret ? `${clientSecret.substring(0, 4)}...${clientSecret.substring(clientSecret.length - 4)} (len=${clientSecret.length})` : "MISSING",
      MICROSOFT_TENANT_ID: tenantId || "MISSING",
      NEXTAUTH_URL: nextauthUrl || "MISSING",
      NEXTAUTH_SECRET: nextauthSecret ? `set (len=${nextauthSecret.length})` : "MISSING",
      NODE_ENV: process.env.NODE_ENV || "unknown",
    },
    callbackUrl: `${nextauthUrl}/api/auth/callback/microsoft`,
    wellKnown: tokenTestResult,
    wellKnownError: tokenTestError || undefined,
    credentialTest,
  });
}
