import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { Resend as ResendClient } from "resend";
import { MagicLinkEmail } from "@/components/emails/MagicLinkEmail";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // adapter: DrizzleAdapter(db), // TODO: Wire up D1 dynamically using getCloudflareContext()
  providers: [
    Resend({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        const resend = new ResendClient(process.env.RESEND_API_KEY);
        const { host } = new URL(url);
        
        const result = await resend.emails.send({
          from: provider.from,
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
});
