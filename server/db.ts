import pg from 'pg'

const { Pool } = pg
const configuredMax = Number.parseInt(process.env.DB_POOL_MAX ?? '10', 10)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:1/syncup',
  max: Number.isInteger(configuredMax) && configuredMax > 0 ? configuredMax : 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error)
})
