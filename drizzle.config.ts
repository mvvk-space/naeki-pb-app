import { defineConfig } from 'drizzle-kit'

/* drizzle-kit for the Neon database (neondb). The DSN comes from the same
   place server/api.ts reads it — $NAEKI_DSN or the 0600 dsn file — so this
   reads it the same way. Introspect:  npx drizzle-kit pull
   Generate migrations from db/schema.ts: npx drizzle-kit generate
   Apply locally:                         npx drizzle-kit push */
export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './db/drizzle',
  dbCredentials: {
    url:
      process.env.NAEKI_DSN ||
      (process.env.HOME ? `${process.env.HOME}/.config/neon/naeki-sushi.dsn` : ''),
  },
})