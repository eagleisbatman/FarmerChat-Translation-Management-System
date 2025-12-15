import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { users, accounts, sessions, verificationTokens } from "./db/schema";
import { isEmailAllowed } from "./auth-config";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false;
      }

      // Check if email domain is allowed
      if (!isEmailAllowed(user.email)) {
        return false;
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        const dbUser = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);

        if (dbUser[0]) {
          session.user.role = dbUser[0].role;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
    error: "/auth/error",
  },
});

