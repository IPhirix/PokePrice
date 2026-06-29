import { Pool } from 'pg'

let _pool: Pool | null = null

export function getPricePool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL not set')
    _pool = new Pool({ connectionString: url, max: 3 })
  }
  return _pool
}
