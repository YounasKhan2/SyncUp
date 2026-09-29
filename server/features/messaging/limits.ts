import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import type { AuthenticatedRequest } from '../auth/types.js'

const accountLimit = (limit: number, windowMs: number) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => {
    const userId = (request as AuthenticatedRequest).auth?.userId
    return userId ?? ipKeyGenerator(request.ip ?? '')
  },
  message: { error: { code: 'rate_limited', message: 'Too many requests. Try again shortly.' } },
})

export const searchLimiter = accountLimit(60, 60_000)
export const requestLimiter = accountLimit(10, 15 * 60_000)
export const groupLimiter = accountLimit(10, 60 * 60_000)
export const messageLimiter = accountLimit(120, 60_000)
