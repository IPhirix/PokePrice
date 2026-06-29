import { useNavigate } from 'react-router-dom'
import PriceChangeIndicator from './PriceChangeIndicator'

const CONDITION_LABEL = {
  raw: 'Raw',
  psa10: 'PSA 10',
  psa9: 'PSA 9',
  psa8: 'PSA 8',
  cgc10: 'CGC 10',
  cgc9: 'CGC 9'
}

export default function CardGrid({ cards, onRemove }) {
  const navigate = useNavigate()

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-600">
        <p className="text-lg mb-2">No cards tracked yet</p>
        <p className="text-sm">Click "Add Card" to start tracking prices</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.id}
          className="bg-surface-800 border border-surface-600 rounded-xl overflow-hidden hover:border-surface-500 transition-all group cursor-pointer"
          onClick={() => navigate(`/card/${card.id}`)}
        >
          <div className="relative bg-surface-900 flex items-center justify-center h-36 overflow-hidden">
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.name}
                className="h-32 object-contain group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="text-slate-600 text-xs text-center px-2">No image</div>
            )}
            <span className="absolute top-2 right-2 bg-surface-900/80 text-slate-400 text-xs px-1.5 py-0.5 rounded">
              {CONDITION_LABEL[card.condition] || card.condition}
            </span>
          </div>

          <div className="p-3">
            <p className="text-white text-xs font-semibold truncate">{card.name}</p>
            <p className="text-slate-500 text-xs truncate mb-2">{card.setName}</p>

            <div className="flex items-center justify-between">
              <div>
                {card.currentPrice !== null ? (
                  <p className="text-accent font-bold text-sm">
                    ${card.currentPrice.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                ) : (
                  <p className="text-slate-600 text-sm">—</p>
                )}
                {card.quantity > 1 && (
                  <p className="text-slate-500 text-xs">×{card.quantity}</p>
                )}
              </div>

              <div className="flex gap-2">
                <PriceChangeIndicator value={card.changeDay} label="1D" />
                <PriceChangeIndicator value={card.changeWeek} label="1W" />
              </div>
            </div>
          </div>

          <div
            className="px-3 pb-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onRemove(card.id)}
              className="text-xs text-red-500 hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
