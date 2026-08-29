import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations run DDL, which Neon's pooled endpoint refuses. Point them at
    // the direct URL and fall back to DATABASE_URL for non-Neon setups.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
