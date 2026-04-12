import { type NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "microsoft",
      name: "Microsoft",
      type: "oauth",
      authorization: {
        url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        params: {
          scope: "openid profile email offline_access Files.ReadWrite.All Mail.Send User.Read",
          response_type: "code",
        },
      },
      token: {
        url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        async request({ client, params, checks, provider }) {
          // Manual token exchange to ensure we capture all fields
          const response = await client.oauthCallback(
            provider.callbackUrl,
            params,
            checks,
            { exchangeBody: { client_secret: process.env.MICROSOFT_CLIENT_SECRET! } }
          );
          return { tokens: response };
        },
      },
      userinfo: {
        url: "https://graph.microsoft.com/oidc/userinfo",
      },
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      checks: ["state"],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email || profile.preferred_username,
          image: null,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account }) {
      // On initial sign-in, persist the OAuth tokens
      if (account) {
        console.log("[NextAuth] JWT — initial sign-in", {
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

      // Token still valid — return as-is
      const expiresAt = token.accessTokenExpires as number;
      if (Date.now() < expiresAt) {
        return token;
      }

      // Token expired — attempt refresh
      console.log("[NextAuth] JWT — token expired, refreshing", {
        expiredAt: new Date(expiresAt).toISOString(),
        hasRefreshToken: !!token.refreshToken,
      });

      if (!token.refreshToken) {
        console.error("[NextAuth] JWT — no refresh token available, cannot refresh");
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

  events: {
    async signIn({ account }) {
      console.log("[NextAuth] signIn event — provider:", account?.provider);
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
    console.log("[NextAuth] Refreshing access token...");

    const body = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken as string,
      scope: "openid profile email offline_access Files.ReadWrite.All Mail.Send User.Read",
    });

    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[NextAuth] Token refresh failed:", {
        status: response.status,
        error: data.error,
        description: data.error_description,
      });
      throw new Error(data.error_description || data.error || "Token refresh failed");
    }

    console.log("[NextAuth] Token refreshed successfully", {
      expiresIn: data.expires_in,
      hasNewRefreshToken: !!data.refresh_token,
    });

    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      accessTokenExpires: Date.now() + (data.expires_in as number) * 1000,
      error: undefined,
    };
  } catch (err) {
    console.error("[NextAuth] refreshAccessToken error:", err);
    return {
      ...token,
      error: "RefreshAccessTokenError" as const,
    };
  }
}
