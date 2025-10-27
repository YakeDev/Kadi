import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import invoicesRouter from './routes/invoices.js'
import aiRouter from './routes/ai.js'
import clientsRouter from './routes/clients.js'
import productsRouter from './routes/products.js'
import authRouter from './routes/auth.js'

dotenv.config()

const normalizeOrigin = (value) => value?.trim().replace(/\/$/, '')
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean)

if (allowedOrigins.length > 0) {
  console.log(`[CORS] Origines autorisées : ${allowedOrigins.join(', ')}`)
} else {
  console.warn(
    '[CORS] ALLOWED_ORIGINS est vide – toutes les origines sont autorisées (usage développement).'
  )
}

const mapDatabaseError = (error) => {
  if (!error) return null

  if (error.code === '23505') {
    const constraint = error.constraint || error.message || ''
    if (constraint.includes('catalog_items_tenant_sku_key')) {
      return {
        status: 409,
        message: 'Ce SKU est déjà utilisé pour un autre élément de votre catalogue.'
      }
    }
    return {
      status: 409,
      message: 'Cette valeur doit être unique.'
    }
  }

  if (error.code === '23503') {
    return {
      status: 409,
      message: 'Cette opération est impossible car la ressource est liée à d’autres données.'
    }
  }

  if (error.code === '22P02') {
    return {
      status: 400,
      message: 'Format de donnée invalide, merci de vérifier les informations envoyées.'
    }
  }

  return null
}

const buildErrorResponse = (error) => {
  const mapped = mapDatabaseError(error)
  if (mapped) {
    return mapped
  }

  const status = Number.isInteger(error?.status) ? error.status : 500
  if (status < 500 && error?.message) {
    return { status, message: error.message }
  }

  return {
    status,
    message:
      status >= 500
        ? 'Une erreur interne est survenue. Veuillez réessayer plus tard.'
        : 'Requête invalide.'
  }
}

const app = express()

const corsOptions = {
  origin(origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin)

    if (!normalizedOrigin) {
      return callback(null, true)
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true)
    }

    console.warn(`[CORS] Origine refusée : ${normalizedOrigin}`)
    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(morgan('tiny'))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'kadi-backend', time: new Date().toISOString() })
})

app.use('/api/invoices', invoicesRouter)
app.use('/api/ai', aiRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/products', productsRouter)
app.use('/api/auth', authRouter)

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  const { status, message } = buildErrorResponse(error)
  const logPayload = {
    method: req.method,
    path: req.originalUrl,
    status,
    code: error?.code,
    constraint: error?.constraint,
    details: error?.details,
    originalMessage: error?.message
  }

  if (status >= 500) {
    console.error('[API ERROR]', logPayload, error?.stack)
  } else {
    console.warn('[API WARNING]', logPayload)
  }

  res.status(status).json({ message })
})

export default app
