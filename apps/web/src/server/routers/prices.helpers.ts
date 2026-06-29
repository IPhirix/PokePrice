import { getConditionPrice } from '../../lib/priceUtils'

interface BuildForTcgCardInput {
  allConditions: Record<string, number | null>
  history: { date: string; price: number }[]
  condition: string
}

export function buildForTcgCardResult({ allConditions, history, condition }: BuildForTcgCardInput) {
  const price = getConditionPrice(allConditions, condition)

  let changeDay: number | null = null
  if (history.length >= 2) {
    const prev = history[history.length - 2].price
    const curr = history[history.length - 1].price
    if (prev > 0) changeDay = Math.round(((curr - prev) / prev) * 10000) / 100
  }

  return { price, allConditions, history, changeDay }
}
