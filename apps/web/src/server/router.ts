import { router } from './trpc'
import { cardsRouter } from './routers/cards'
import { portfolioRouter } from './routers/portfolio'
import { pricesRouter } from './routers/prices'
import { cardShowsRouter } from './routers/card-shows'
import { profilesRouter } from './routers/profiles'
import { tradesRouter } from './routers/trades'
import { activityRouter } from './routers/activity'

export const appRouter = router({
  cards: cardsRouter,
  portfolio: portfolioRouter,
  prices: pricesRouter,
  cardShows: cardShowsRouter,
  profiles: profilesRouter,
  trades: tradesRouter,
  activity: activityRouter,
})

export type AppRouter = typeof appRouter
