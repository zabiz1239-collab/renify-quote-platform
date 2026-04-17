import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
          return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    return NextResponse.json({
          refreshToken: token.refreshToken ?? null,
          accessToken: token.accessToken ?? null,
          email: token.email ?? null,
          note: "DELETE THIS ROUTE IMMEDIATELY AFTER COPYING THE TOKEN",
    });
}
