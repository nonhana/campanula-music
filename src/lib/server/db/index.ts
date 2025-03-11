import { TURSO_AUTH_TOKEN, TURSO_DATABASE_URL } from '$env/static/private'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

if (!TURSO_AUTH_TOKEN || !TURSO_DATABASE_URL)
  throw new Error('TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is not set')

const client = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
})
export const db = drizzle(client, { schema })
