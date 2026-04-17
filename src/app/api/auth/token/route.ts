import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({
      error: "Not signed in. Go to /login first, then come back here.",
    }, { status: 401 });
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  return NextResponse.json({
    message: "Copy the refreshToken below and give it to Claude to set as CRON_REFRESH_TOKEN",
    refreshToken: token?.refreshToken || "No refresh token found — try signing out and back in",
    accessTokenExpires: token?.accessTokenExpires
      ? new Date(token.accessTokenExpires as number).toISOString()
      : "unknown",
    user: session.user?.email || session.user?.name || "unknown",
  });
}
