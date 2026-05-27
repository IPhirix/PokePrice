const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const dataDir = app.getPath('userData')
const cardsFile = path.join(dataDir, 'cards.json')

function readCards() {
  if (!fs.existsSync(cardsFile)) return []
  try {
    return JSON.parse(fs.readFileSync(cardsFile, 'utf8'))
  } catch {
    return []
  }
}

function writeCards(cards) {
  fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2))
}

function getPriceFile(cardId) {
  return path.join(dataDir, `prices-${cardId}.json`)
}

function readPrices(cardId) {
  const file = getPriceFile(cardId)
  if (!fs.existsSync(file)) return []
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return []
  }
}

function appendPrice(cardId, priceEntry) {
  const history = readPrices(cardId)
  const today = new Date().toISOString().split('T')[0]
  const filtered = history.filter((p) => p.date !== today)
  filtered.push({ date: today, ...priceEntry })
  filtered.sort((a, b) => a.date.localeCompare(b.date))
  fs.writeFileSync(getPriceFile(cardId), JSON.stringify(filtered, null, 2))
}

function deleteCardData(cardId) {
  const file = getPriceFile(cardId)
  if (fs.existsSync(file)) fs.unlinkSync(file)
}

module.exports = { readCards, writeCards, readPrices, appendPrice, deleteCardData }
