import { createClient } from 'redis'
import { env } from '../config/env.js'

export const redisClient = createClient({
  url: env.REDIS_URL,
})

redisClient.on('error', (error) => {
  console.error('Redis error:', error)
})

export async function checkRedisConnection() {
  if (!redisClient.isOpen) {
    await redisClient.connect()
  }

  await redisClient.ping()
}