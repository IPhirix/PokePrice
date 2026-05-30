require('dotenv').config()
const { Client } = require('pg')

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  console.log('Connected to Supabase')

  const searchTerm = process.argv[2] || 'Charizard'

  const res = await client.query(`
    SELECT
      product_name,
      console_name,
      snapshot_date,
      loose_price,
      graded_price,
      bgs_10_price,
      condition_17_price  AS psa10_price,
      condition_18_price  AS psa9_price
    FROM pokemon_card_prices
    WHERE product_name ILIKE $1
    ORDER BY snapshot_date DESC
    LIMIT 5
  `, [`%${searchTerm}%`])

  console.log(`\nResults for "${searchTerm}" (${res.rows.length} rows):`)
  console.table(res.rows)

  await client.end()
}

main().catch(err => { console.error(err); process.exit(1) })
