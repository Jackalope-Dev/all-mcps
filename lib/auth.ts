import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { Resend as ResendClient } from "resend";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import { MagicLinkEmail } from "@/components/emails/MagicLinkEmail";

// D1 bindings are only available per-request in the Workers runtime, so the
// adapter is resolved via NextAuth's function-config form rather than at
// module scope.
export const { handlers, signIn, signOut, auth } = NextAuth(async () => {
  const ctx = await getCloudflareContext();
  const db = drizzle((ctx.env as any).DB as any);

  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    trustHost: true,
    providers: [
      Resend({
        from: `AllMCPs <${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"}>`,
        sendVerificationRequest: async ({ identifier, url, provider }) => {
          const resend = new ResendClient(process.env.RESEND_API_KEY);
          const { host } = new URL(url);
          const fromAddress: string =
            provider.from || `AllMCPs <${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"}>`;

          const result = await resend.emails.send({
            from: fromAddress,
            to: identifier,
            subject: `Sign in to ${host}`,
            react: MagicLinkEmail({ loginUrl: url }) as React.ReactElement,
          });

          if (result.error) {
            throw new Error(`Resend error: ${result.error.message}`);
          }
        }
      }),
    ],
    pages: {
      signIn: "/login",
      verifyRequest: "/verify-request",
    },
    session: {
      strategy: "jwt",
    },
    callbacks: {
      session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub;
        }
        return session;
      },
    },
  };
});
