import type { Card, PortfolioStats } from '@pokeprice/types'

/**
 * Computes aggregate portfolio stats from an array of cards.
 * Each card must already have currentPrice / changeDay / changeWeek / changeMonth populated.
 */
export function calcPortfolioStats(cards: Card[]): PortfolioStats {
  let totalValue = 0
  let totalCost = 0
  let cardsWithPrice = 0
  let cardsWithCost = 0

  for (const card of cards) {
    if (card.currentPrice != null) {
      totalValue += card.currentPrice * card.quantity
      cardsWithPrice++
    }
    if (card.purchasePrice != null) {
      totalCost += card.purchasePrice * card.quantity
      cardsWithCost++
    }
  }

  const totalGain = cardsWithCost > 0 ? totalValue - totalCost : 0
  const totalGainPct = cardsWithCost > 0 && totalCost > 0
    ? Math.round((totalGain / totalCost) * 10000) / 100
    : 0

  // Day/week/month changes: sum up (price * change%) across cards that have a change value
  let dayChange = 0, weekChange = 0, monthChange = 0
  for (const card of cards) {
    if (card.currentPrice == null) continue
    const val = card.currentPrice * card.quantity
    if (card.changeDay != null)   dayChange   += val * (card.changeDay / 100)
    if (card.changeWeek != null)  weekChange  += val * (card.changeWeek / 100)
    if (card.changeMonth != null) monthChange += val * (card.changeMonth / 100)
  }

  const dayChangePct   = totalValue > 0 ? Math.round((dayChange / totalValue) * 10000) / 100 : 0
  const weekChangePct  = totalValue > 0 ? Math.round((weekChange / totalValue) * 10000) / 100 : 0
  const monthChangePct = totalValue > 0 ? Math.round((monthChange / totalValue) * 10000) / 100 : 0

  // Top movers: cards with the largest absolute day change, descending
  const topMovers = [...cards]
    .filter(c => c.currentPrice != null && c.changeDay != null)
    .sort((a, b) => Math.abs(b.changeDay!) - Math.abs(a.changeDay!))
    .slice(0, 5)

  return {
    totalValue:    Math.round(totalValue * 100) / 100,
    totalCost:     Math.round(totalCost * 100) / 100,
    totalGain:     Math.round(totalGain * 100) / 100,
    totalGainPct,
    dayChange:     Math.round(dayChange * 100) / 100,
    dayChangePct,
    weekChange:    Math.round(weekChange * 100) / 100,
    weekChangePct,
    monthChange:   Math.round(monthChange * 100) / 100,
    monthChangePct,
    cardCount:     cardsWithPrice,
    topMovers,
  }
}
