const axios = require('axios')
const cheerio = require('cheerio')

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache'
}

function buildEbayQuery(card) {
  const { name, setName, condition } = card
  if (card.ebayQuery) return card.ebayQuery

  const grade = condition === 'raw' ? '' : condition.replace('psa', 'PSA ').replace('cgc', 'CGC ')
  return `${name} ${setName} pokemon card${grade ? ' ' + grade : ''}`
}

async function fetchEbayPrice(card) {
  const query = buildEbayQuery(card)
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1&_sop=13`

  const res = await axios.get(url, { headers: HEADERS, timeout: 15000 })
  const $ = cheerio.load(res.data)

  const prices = []
  $('.s-item').each((_, el) => {
    const title = $(el).find('.s-item__title').text().toLowerCase()
    if (title.includes('shop on ebay')) return

    const priceText = $(el).find('.s-item__price').first().text()
    const match = priceText.match(/\$?([\d,]+\.?\d*)/)
    if (match) {
      const price = parseFloat(match[1].replace(',', ''))
      if (!isNaN(price) && price > 0.5) prices.push(price)
    }
  })

  if (prices.length === 0) return null

  const recent = prices.slice(0, 15)
  recent.sort((a, b) => a - b)
  const trimmed = recent.slice(
    Math.floor(recent.length * 0.1),
    Math.ceil(recent.length * 0.9)
  )
  return trimmed.length > 0
    ? Math.round((trimmed.reduce((a, b) => a + b, 0) / trimmed.length) * 100) / 100
    : null
}

function getTcgPlayerPrice(card) {
  if (!card.tcgPlayerPrices) return null
  const cond = card.condition
  const prices = card.tcgPlayerPrices
  if (cond === 'raw') return prices.holofoil?.market || prices.normal?.market || prices.reverseHolofoil?.market || null
  return null
}

async function getPrice(card) {
  try {
    const price = await fetchEbayPrice(card)
    if (price !== null) return { price, source: 'ebay' }
  } catch (err) {
    console.warn(`eBay scrape failed for ${card.name}:`, err.message)
  }

  const fallback = getTcgPlayerPrice(card)
  if (fallback !== null) return { price: fallback, source: 'tcgplayer' }

  return null
}

module.exports = { getPrice, buildEbayQuery }
