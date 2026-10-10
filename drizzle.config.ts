import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)
  throw new Error('TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is not set')

export default defineConfig({
  out: './drizzle',
  schema: './src/lib/server/db/schema.ts',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
  dialect: 'turso',
})
