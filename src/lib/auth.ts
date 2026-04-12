import { type NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "microsoft",
      name: "Microsoft",
      type: "oauth",
      // Do NOT use wellKnown with tenant=common — it returns a templated
      // issuer ({tenantid}) that won't match the real ID token issuer,
      // causing silent OAuthCallback failures.
      authorization: {
        url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        params: {
          scope: "openid profile email offline_access Files.ReadWrite.All Mail.Send User.Read",
          response_type: "code",
        },
      },
      token: {
        url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      },
      userinfo: {
        url: "https://graph.microsoft.com/oidc/userinfo",
      },
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      // Use state-only checks — no nonce (issuer mismatch with common tenant)
      // and no PKCE (not needed for confidential clients with a client secret)
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
      // On initial sign-in, store the tokens
      if (account) {
        console.log("[NextAuth] JWT callback — initial sign-in, storing tokens");
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
      }

      // Return token if it hasn't expired
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Token expired — refresh it
      console.log("[NextAuth] JWT callback — token expired, refreshing");
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
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

async function refreshAccessToken(token: import("next-auth/jwt").JWT) {
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
          scope: "openid profile email offline_access Files.ReadWrite.All Mail.Send User.Read",
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[NextAuth] Token refresh failed:", data.error, data.error_description);
      throw new Error(data.error_description || "Failed to refresh token");
    }

    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      accessTokenExpires: Date.now() + data.expires_in * 1000,
    };
  } catch {
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}
