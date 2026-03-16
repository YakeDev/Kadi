const DEFAULT_CLEANUP_INTERVAL = 100

const getClientIdentifier = (req) =>
  req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  'anonymous'

export const createRateLimiter = ({
  name = 'global',
  windowMs,
  max,
  message,
  keyGenerator
}) => {
  const hits = new Map()
  let requestCount = 0

  const pruneExpiredEntries = (now) => {
    for (const [key, entry] of hits.entries()) {
      if (entry.resetAt <= now) {
        hits.delete(key)
      }
    }
  }

  return (req, res, next) => {
    const now = Date.now()
    requestCount += 1

    if (requestCount % DEFAULT_CLEANUP_INTERVAL === 0) {
      pruneExpiredEntries(now)
    }

    const rawKey = keyGenerator?.(req) || getClientIdentifier(req)
    const key = `${name}:${rawKey}`
    const current = hits.get(key)
    const entry =
      current && current.resetAt > now
        ? current
        : {
            count: 0,
            resetAt: now + windowMs
          }

    entry.count += 1
    hits.set(key, entry)

    const remaining = Math.max(max - entry.count, 0)
    const retryAfterSeconds = Math.max(Math.ceil((entry.resetAt - now) / 1000), 1)

    res.setHeader('X-RateLimit-Limit', String(max))
    res.setHeader('X-RateLimit-Remaining', String(remaining))
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetAt).toISOString())

    if (entry.count > max) {
      res.setHeader('Retry-After', String(retryAfterSeconds))
      return res.status(429).json({
        message
      })
    }

    return next()
  }
}
