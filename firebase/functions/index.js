'use strict'

const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const axios = require('axios')

admin.initializeApp()

const pricechartingToken = defineSecret('PRICECHARTING_TOKEN')

// Runs daily at 7:00 AM Central Time
exports.dailyPriceDownload = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'America/Chicago',
    secrets: [pricechartingToken],
    timeoutSeconds: 120,
    memory: '256MiB'
  },
  async () => {
    const token = pricechartingToken.value()
    if (!token) {
      console.error('PRICECHARTING_TOKEN secret not set')
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const bucket = admin.storage().bucket()
    const file = bucket.file(`prices/${today}.csv`)

    // Idempotent: skip if today's file already exists
    const [exists] = await file.exists()
    if (exists) {
      console.log(`prices/${today}.csv already exists, skipping`)
      return
    }

    const url = `https://www.pricecharting.com/price-guide/download-custom?t=${token}&category=pokemon-cards`
    let csvText
    try {
      const res = await axios.get(url, { timeout: 90000, responseType: 'text' })
      csvText = typeof res.data === 'string' ? res.data : null
    } catch (err) {
      console.error('PriceCharting download failed:', err.message)
      return
    }

    if (!csvText || csvText.length < 100) {
      console.error('Empty or invalid CSV response')
      return
    }

    await file.save(csvText, {
      contentType: 'text/csv; charset=utf-8',
      metadata: { cacheControl: 'public, max-age=86400' }
    })

    console.log(`Uploaded prices/${today}.csv — ${csvText.length} bytes`)
  }
)
