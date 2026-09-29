import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { authRouter } from './features/auth/routes.js'
import { callsRouter } from './features/calls/routes.js'
import { pool } from './db.js'
import { messagingRouter } from './features/messaging/routes.js'
import { realtimeRouter, startRealtimeListener, stopRealtimeListener } from './features/realtime/routes.js'
import { uploadsRouter } from './features/media/routes.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())
app.get('/api/health', async (_request, response) => {
  if (!process.env.DATABASE_URL) {
    response.status(503).json({
      error: { code: 'service_unavailable', message: 'DATABASE_URL is not configured.' },
    })
    return
  }
  try {
    await pool.query('SELECT 1')
    response.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    console.error('Health check failed: PostgreSQL unavailable', error)
    response.status(503).json({ error: { code: 'service_unavailable', message: 'Database unavailable.' } })
  }
})
app.use('/api/auth', (_request, response, next) => {
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) {
    response.status(503).json({
      error: { code: 'service_unavailable', message: 'Configure DATABASE_URL and AUTH_SECRET to use accounts.' },
    })
    return
  }
  next()
})
app.use('/api/auth', authRouter)
app.use('/api', realtimeRouter)
app.use('/api', callsRouter)
app.use('/api', uploadsRouter)
app.use('/api', messagingRouter)
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const status = typeof error === 'object' && error !== null && 'status' in error
    && typeof error.status === 'number' && error.status >= 400 && error.status < 500
    ? error.status
    : 500
  if (status >= 500) console.error('Unhandled API error', error)
  response.status(status).json({
    error: {
      code: status === 400 ? 'validation' : status === 413 ? 'payload_too_large' : 'internal_error',
      message: status >= 500 ? 'An unexpected error occurred.' : 'The request could not be processed.',
    },
  })
})

app.listen(port, () => {
  console.info(`SyncUp API listening on http://localhost:${port}`)
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set; database-backed routes will return service unavailable.')
  } else {
    void startRealtimeListener()
  }
  if (!process.env.AUTH_SECRET) {
    console.warn('AUTH_SECRET is not set; account routes will return service unavailable.')
  }
})

process.on('SIGTERM', () => {
  stopRealtimeListener()
  void pool.end().then(() => process.exit(0))
})
