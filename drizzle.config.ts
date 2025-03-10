import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL is not set')

export default defineConfig({
  out: './drizzle',
  schema: './src/lib/server/db/schema.ts',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
  verbose: true,
  strict: true,
  dialect: 'sqlite',
})
