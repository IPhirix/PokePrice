const cron = require('node-cron')
const { readCards, appendPrice } = require('./store')
const { getPrice } = require('./ebay')

let task = null

async function refreshAllPrices(onProgress) {
  const cards = readCards()
  const results = []

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    if (onProgress) onProgress({ current: i + 1, total: cards.length, name: card.name })

    try {
      const result = await getPrice(card)
      if (result) {
        appendPrice(card.id, result)
        results.push({ id: card.id, ...result })
      }
    } catch (err) {
      console.error(`Failed to fetch price for ${card.name}:`, err.message)
    }

    if (i < cards.length - 1) {
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  return results
}

function startScheduler(mainWindow) {
  task = cron.schedule('0 8 * * *', async () => {
    console.log('Running scheduled price refresh...')
    await refreshAllPrices((progress) => {
      mainWindow?.webContents.send('prices:progress', progress)
    })
    mainWindow?.webContents.send('prices:refreshed')
  })
}

function stopScheduler() {
  task?.stop()
}

module.exports = { startScheduler, stopScheduler, refreshAllPrices }
