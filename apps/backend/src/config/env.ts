import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const envFilePath = resolve(fileURLToPath(new URL('../../.env', import.meta.url)))
loadEnv({ path: envFilePath })

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  POSTGRES_URL: z.url(),
  REDIS_URL: z.url(),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-4.1-mini'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
})

export const env = envSchema.parse(process.env)