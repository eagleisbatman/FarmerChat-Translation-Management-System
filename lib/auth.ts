import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { users, accounts, sessions, verificationTokens } from "./db/schema";
import { eq } from "drizzle-orm";
import { autoJoinOrganizationByDomain } from "./organizations/context";

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

      // Check if email domain is allowed (global check first)
      // Organization-level checks happen after user is created/joined
      const { isEmailAllowedSync } = await import("./auth-config");
      if (!isEmailAllowedSync(user.email)) {
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
          session.user.organizationId = dbUser[0].organizationId || undefined;

          // Auto-join user to organization based on email domain if not already joined
          // This runs on every session, but autoJoinOrganizationByDomain checks for existing membership
          if (dbUser[0].email && !dbUser[0].organizationId) {
            try {
              await autoJoinOrganizationByDomain(user.id, dbUser[0].email);
              // Refresh user data after auto-join
              const [updatedUser] = await db
                .select()
                .from(users)
                .where(eq(users.id, user.id))
                .limit(1);
              if (updatedUser) {
                session.user.organizationId = updatedUser.organizationId || undefined;
              }
            } catch (error) {
              console.error("Error auto-joining organization:", error);
              // Don't fail session creation if auto-join fails
            }
          }
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

