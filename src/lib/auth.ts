import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  // Left undefined in dev so better-auth infers the origin from the request
  // and any port works. Production must set BETTER_AUTH_URL explicitly.
  baseURL: process.env.BETTER_AUTH_URL || undefined,

  emailAndPassword: {
    enabled: true,
    // A hackathon demo has no mail server; letting judges sign in immediately
    // matters more than verified addresses.
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  user: {
    additionalFields: {
      // Everyone self-serving through the signup form is a citizen. Staff
      // roles are granted by an admin or the seed script, never claimed.
      role: { type: "string", input: false, defaultValue: "CITIZEN" },
      phone: { type: "string", required: false, input: true },
      departmentId: { type: "string", required: false, input: false },
      wardId: { type: "string", required: false, input: false },
      available: { type: "boolean", required: false, input: false },
    },
  },

  plugins: [nextCookies()],
});

export type Auth = typeof auth;
