import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { signInSchema } from "@/lib/validations";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // TODO: Replace with real DB lookup + bcrypt/argon2 comparison
        // Stub: accept any well-formed credentials and signal OTP required
        const { email } = parsed.data;
        return {
          id: "stub-user-id",
          email,
          name: email.split("@")[0],
          requiresOtp: true,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.requiresOtp = (user as { requiresOtp?: boolean }).requiresOtp;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.requiresOtp) {
        // Session is pending OTP verification — handled client-side redirect
        (session as typeof session & { requiresOtp: boolean }).requiresOtp = true;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
});
