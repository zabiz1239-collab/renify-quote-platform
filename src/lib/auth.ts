import { type NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import AzureAD from "next-auth/providers/azure-ad";

export const authOptions: NextAuthOptions = {
  providers: [
    AzureAD({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: "common",
      authorization: {
        params: {
          scope: "openid profile email offline_access User.Read Files.ReadWrite.All Mail.Send",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        console.log("[NextAuth] JWT — sign-in", {
          provider: account.provider,
          hasAccessToken: !!account.access_token,
          hasRefreshToken: !!account.refresh_token,
          expiresAt: account.expires_at,
        });
        return {
          ...token,
          accessToken: account.access_token as string,
          refreshToken: account.refresh_token as string,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
        };
      }

      const expiresAt = token.accessTokenExpires as number;
      if (Date.now() < expiresAt) {
        return token;
      }

      if (!token.refreshToken) {
        return { ...token, error: "RefreshAccessTokenError" as const };
      }

      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },

  logger: {
    error(code, metadata) {
      console.error("[NextAuth Error]", code, JSON.stringify(metadata, null, 2));
    },
    warn(code) {
      console.warn("[NextAuth Warn]", code);
    },
  },

  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: token.refreshToken as string,
          scope: "openid profile email offline_access User.Read Files.ReadWrite.All Mail.Send",
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[NextAuth] Refresh failed:", data.error, data.error_description);
      throw new Error(data.error_description || "Token refresh failed");
    }

    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      accessTokenExpires: Date.now() + (data.expires_in as number) * 1000,
      error: undefined,
    };
  } catch (err) {
    console.error("[NextAuth] refreshAccessToken error:", err);
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}
