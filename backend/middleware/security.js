import { createRateLimiter } from './rateLimit.js'

const parseNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const buildUserScopedKey = (req) => req.user?.id || req.tenantId || req.ip || 'anonymous'

export const authRateLimit = createRateLimiter({
  name: 'auth',
  windowMs: parseNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: parseNumber(process.env.AUTH_RATE_LIMIT_MAX, 10),
  message: 'Trop de tentatives sensibles. Réessayez dans quelques minutes.'
})

export const aiRateLimit = createRateLimiter({
  name: 'ai',
  windowMs: parseNumber(process.env.AI_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: parseNumber(process.env.AI_RATE_LIMIT_MAX, 12),
  message: "Trop de requêtes IA pour le moment. Réessayez un peu plus tard.",
  keyGenerator: buildUserScopedKey
})

export const pdfRateLimit = createRateLimiter({
  name: 'pdf',
  windowMs: parseNumber(process.env.PDF_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: parseNumber(process.env.PDF_RATE_LIMIT_MAX, 30),
  message: 'Trop de téléchargements PDF pour le moment. Réessayez un peu plus tard.',
  keyGenerator: buildUserScopedKey
})
