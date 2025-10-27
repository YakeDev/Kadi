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

const normalizeOrigin = value => value?.trim().replace(/\/$/, '')
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean)

if (allowedOrigins.length > 0) {
  console.log(`[CORS] Origines autorisées : ${allowedOrigins.join(', ')}`)
} else {
  console.warn('[CORS] ALLOWED_ORIGINS est vide – toutes les origines sont autorisées (usage développement).')
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
  console.error(error)
  res.status(error.status || 500).json({
    message: error.message || 'Erreur interne du serveur'
  })
})

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`✅ KADI backend actif sur le port ${PORT}`)
})

export default app
