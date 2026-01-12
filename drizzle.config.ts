import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use environment variable directly so it can be overridden at runtime
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
})
