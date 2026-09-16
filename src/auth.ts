import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SUPERADMIN_EMAIL = "sudarshan.contactwebdev@gmail.com";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        rollNo: { label: "Admin ID", type: "text" },
        password: { label: "Password", type: "password" },
        fullName: { label: "Full Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.rollNo || !credentials?.password || !credentials?.fullName) return null;
        const user = await prisma.user.findUnique({
          where: { rollNo: credentials.rollNo as string },
        });
        if (!user) return null;
        if (user.role !== "ADMIN" && user.role !== "SUPERADMIN") return null;
        if (user.password !== credentials.password) return null;
        return { 
          id: String(user.id), 
          name: credentials.fullName as string,  // Use the name they entered
          email: user.email || "", 
          role: user.role 
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (user.email !== SUPERADMIN_EMAIL) return false;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google") {
          token.role = "SUPERADMIN";
        } else {
          token.role = (user as any).role || "STUDENT";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin-login",
    error: "/admin-login",
  },
  secret: process.env.NEXTAUTH_SECRET,
});
