'use strict'

const axios = require('axios')
const path = require('path')
const fs = require('fs')

function storageBase(bucket) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o`
}

// Returns sorted array of date strings (YYYY-MM-DD) available in Firebase Storage
async function listAvailableDates(bucket) {
  const res = await axios.get(storageBase(bucket), {
    params: { prefix: 'prices/', delimiter: '/' },
    timeout: 10000
  })
  const items = res.data.items || []
  return items
    .map((item) => decodeURIComponent(item.name).replace('prices/', '').replace('.csv', ''))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
}

// Downloads a dated CSV from Firebase Storage, caching it to disk.
// Returns the CSV text, or null if unavailable.
async function downloadCsvForDate(date, bucket, cacheDir) {
  const cachePath = path.join(cacheDir, `${date}.csv`)
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath, 'utf8')
  }

  const encodedPath = encodeURIComponent(`prices/${date}.csv`)
  const url = `${storageBase(bucket)}/${encodedPath}?alt=media`
  const res = await axios.get(url, { timeout: 90000, responseType: 'text' })
  const text = typeof res.data === 'string' && res.data.length > 100 ? res.data : null

  if (text) {
    try {
      fs.mkdirSync(cacheDir, { recursive: true })
      fs.writeFileSync(cachePath, text, 'utf8')
    } catch (e) {
      // Cache write failure is non-fatal
    }
  }
  return text
}

module.exports = { listAvailableDates, downloadCsvForDate }
