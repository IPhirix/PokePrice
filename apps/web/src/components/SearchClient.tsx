"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { trpc } from "@/trpc/react";
import type { CardCondition, TcgCard } from "@pokeprice/types";
import TcgCardDetailModal from "./TcgCardDetailModal";

type GradableCondition = Exclude<CardCondition, "sealed">;

// ── Sealed product detection ──────────────────────────────────────────────────

const SEALED_KEYWORDS = [
  "elite trainer box",
  "etb",
  "booster box",
  "booster bundle",
  "booster pack",
  "collection box",
  "premium collection",
  "gift box",
  "mini tin",
  "tin",
  "theme deck",
  "starter deck",
  "blister",
  "bundle",
  "display box",
];

function isSealedProductQuery(q: string): boolean {
  const lower = q.toLowerCase();
  return SEALED_KEYWORDS.some((k) => lower.includes(k));
}

interface SealedProduct {
  pricechartingId: string;
  name: string;
  setName: string;
  imageUrl: string | null;
  currentPrice: number | null;
}

function fmtPrice(n: number | null | undefined) {
  if (n == null) return "—";
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// ── Sealed add modal ──────────────────────────────────────────────────────────
function AddSealedModal({
  product,
  onClose,
}: {
  product: SealedProduct;
  onClose: () => void;
}) {
  const [section, setSection] = useState<"portfolio" | "watchlist">(
    "portfolio",
  );
  const [purchasePrice, setPurchasePrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  const utils = trpc.useUtils();
  const addCard = trpc.cards.add.useMutation({
    onSuccess: () => {
      utils.portfolio.dashboard.invalidate();
      setDone(true);
    },
  });

  function submit() {
    setAdding(true);
    addCard.mutate({
      tcgId: null,
      name: product.name,
      setName: product.setName,
      setId: null,
      number: null,
      rarity: null,
      imageUrl: product.imageUrl,
      imageUrlLarge: product.imageUrl,
      condition: "sealed",
      quantity: 1,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      section,
      type: "sealed",
      pricechartingId: product.pricechartingId,
      currentPrice: product.currentPrice,
    });
  }

  const inputCls =
    "w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent";

  if (done) {
    return (
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-surface-800 border border-surface-600 rounded-2xl p-8 max-w-sm w-full text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-white font-semibold mb-1">{product.name}</p>
          <p className="text-slate-400 text-sm mb-6">
            Added to your {section}.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-accent/20 border border-accent/40 text-accent rounded-xl font-medium text-sm hover:bg-accent/30 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-800 border border-surface-600 rounded-2xl p-6 max-w-md w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-surface-700 border border-surface-600">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={64}
                height={64}
                className="w-full h-full object-contain"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                ?
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold leading-tight text-sm">
              {product.name}
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">{product.setName}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-xs bg-blue-900/40 border border-blue-700/40 text-blue-300 px-2 py-0.5 rounded-full font-medium">
                Sealed
              </span>
              <span className="text-accent font-semibold text-sm">
                {fmtPrice(product.currentPrice)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white flex-shrink-0"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Add to</label>
            <select
              value={section}
              onChange={(e) =>
                setSection(e.target.value as "portfolio" | "watchlist")
              }
              className={inputCls}
            >
              <option value="portfolio">Collection</option>
              <option value="watchlist">Watchlist</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Purchase Price ($)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        {addCard.error && (
          <p className="text-red-400 text-xs">{addCard.error.message}</p>
        )}
        <button
          onClick={submit}
          disabled={adding}
          className="w-full py-2.5 bg-accent text-black font-semibold rounded-xl text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
        >
          {adding
            ? "Adding…"
            : `Add to ${section === "portfolio" ? "Collection" : "Watchlist"}`}
        </button>
      </div>
    </div>
  );
}

const CONDITIONS: { value: GradableCondition; label: string }[] = [
  { value: "raw", label: "Raw" },
  { value: "psa10", label: "PSA 10" },
  { value: "psa9", label: "PSA 9" },
  { value: "psa8", label: "PSA 8" },
  { value: "cgc10", label: "CGC 10" },
  { value: "cgc9", label: "CGC 9" },
];

function cardImageUrl(card: TcgCard, size: "low" | "high" = "low") {
  if (!card.image) return null;
  return card.image.replace("/low.webp", `/${size}.webp`);
}

function SearchIcon() {
  return (
    <svg
      className="w-5 h-5 text-slate-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function AddModal({
  card,
  onClose,
  defaultSection = "portfolio",
}: {
  card: TcgCard;
  onClose: () => void;
  defaultSection?: "portfolio" | "watchlist";
}) {
  const [condition, setCondition] = useState<GradableCondition>("raw");
  const [quantity, setQuantity] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [section, setSection] = useState<"portfolio" | "watchlist">(
    defaultSection,
  );
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  const utils = trpc.useUtils();
  const addCard = trpc.cards.add.useMutation({
    onSuccess: () => {
      utils.portfolio.dashboard.invalidate();
      setDone(true);
    },
  });

  const imgUrl = cardImageUrl(card, "low");
  const imgUrlLarge = cardImageUrl(card, "high");

  function submit() {
    setAdding(true);
    addCard.mutate({
      tcgId: card.id,
      name: card.name,
      setName: card.set.name,
      setId: card.set.id,
      number: card.localId || null,
      rarity: card.rarity ?? null,
      imageUrl: imgUrl,
      imageUrlLarge: imgUrlLarge,
      condition,
      quantity,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      section,
    });
  }

  if (done) {
    return (
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-surface-800 border border-surface-600 rounded-2xl p-8 max-w-sm w-full text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-white font-semibold mb-1">{card.name} added</p>
          <p className="text-slate-400 text-sm mb-6">
            Card added to your {section}.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-accent/20 border border-accent/40 text-accent rounded-xl font-medium text-sm hover:bg-accent/30 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-800 border border-surface-600 rounded-2xl p-6 max-w-md w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-16 flex-shrink-0 rounded-lg overflow-hidden bg-surface-700"
            style={{ height: 88 }}
          >
            {imgUrl && (
              <Image
                src={imgUrl}
                alt={card.name}
                width={64}
                height={88}
                className="object-cover w-full h-full"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold truncate">{card.name}</h2>
            <p className="text-slate-400 text-sm">
              {card.set.name}
              {card.localId ? ` · #${card.localId}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white mt-0.5"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Section</label>
            <select
              value={section}
              onChange={(e) =>
                setSection(e.target.value as "portfolio" | "watchlist")
              }
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            >
              <option value="portfolio">Collection</option>
              <option value="watchlist">Watchlist</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Condition
            </label>
            <select
              value={condition}
              onChange={(e) =>
                setCondition(e.target.value as GradableCondition)
              }
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Purchase Price ($)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {addCard.error && (
          <p className="text-red-400 text-xs">{addCard.error.message}</p>
        )}

        <button
          onClick={submit}
          disabled={adding}
          className="w-full py-2.5 bg-accent text-black font-semibold rounded-xl text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {adding
            ? "Adding…"
            : "Add to " +
              (section === "portfolio" ? "Collection" : "Watchlist")}
        </button>
      </div>
    </div>
  );
}

function TcgCardRow({
  card,
  onDetail,
}: {
  card: TcgCard;
  onDetail: (card: TcgCard) => void;
}) {
  const imgUrl = cardImageUrl(card);
  return (
    <button
      onClick={() => onDetail(card)}
      className="w-full flex items-center gap-4 bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 hover:border-surface-500 hover:bg-surface-700/60 transition-colors text-left"
    >
      <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-surface-700">
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={card.name}
            width={40}
            height={56}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
            ?
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{card.name}</p>
        <p className="text-slate-500 text-xs truncate">
          {card.set.name}
          {card.localId ? ` · #${card.localId}` : ""}
          {card.rarity ? ` · ${card.rarity}` : ""}
        </p>
      </div>
      <span className="flex-shrink-0 px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent rounded-lg text-xs font-medium">
        View
      </span>
    </button>
  );
}

export default function SearchClient() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  const [detailCard, setDetailCard] = useState<TcgCard | null>(null);
  const [selectedCard, setSelectedCard] = useState<TcgCard | null>(null);
  const [addSection, setAddSection] = useState<"portfolio" | "watchlist">(
    "portfolio",
  );
  const [selectedSealed, setSelectedSealed] = useState<SealedProduct | null>(
    null,
  );

  const isSealed = isSealedProductQuery(debouncedQuery);

  const handleInput = useCallback(
    (val: string) => {
      setQuery(val);
      if (timer) clearTimeout(timer);
      const t = setTimeout(() => setDebouncedQuery(val), 400);
      setTimer(t);
    },
    [timer],
  );

  const { data: cardResults = [], isFetching: cardFetching } =
    trpc.cards.search.useQuery(debouncedQuery, {
      enabled: debouncedQuery.length >= 2 && !isSealed,
      staleTime: 120_000,
    });

  const { data: sealedResults = [], isFetching: sealedFetching } =
    trpc.cards.searchSealed.useQuery(debouncedQuery, {
      enabled: debouncedQuery.trim().length >= 3 && isSealed,
      staleTime: 300_000,
    });

  const isFetching = isSealed ? sealedFetching : cardFetching;
  const hasQuery = isSealed
    ? debouncedQuery.trim().length >= 3
    : debouncedQuery.length >= 2;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Search Cards</h1>
        <p className="text-slate-400 text-sm">
          Find Pokemon cards and sealed products to add to your collection or
          watchlist.
        </p>
      </div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder='Search cards, or try "Crown Zenith ETB"…'
          className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
          autoFocus
        />
        {isFetching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
          </span>
        )}
      </div>

      {/* Sealed mode indicator */}
      {isSealed && (
        <div className="flex items-center gap-2 text-xs text-blue-300">
          <span className="px-2 py-0.5 bg-blue-900/40 border border-blue-700/40 rounded-full font-medium">
            Sealed
          </span>
          <span className="text-slate-500">Searching sealed products</span>
        </div>
      )}

      {/* No results */}
      {hasQuery && !isFetching && isSealed && sealedResults.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-sm">
          No sealed products found for &ldquo;{debouncedQuery}&rdquo;
        </div>
      )}
      {hasQuery && !isFetching && !isSealed && cardResults.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-sm">
          No cards found for &ldquo;{debouncedQuery}&rdquo;
        </div>
      )}

      {/* Sealed results */}
      {isSealed && sealedResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {sealedResults.length} sealed product
            {sealedResults.length !== 1 ? "s" : ""}
          </p>
          {sealedResults.map((product) => (
            <button
              key={product.pricechartingId}
              onClick={() => setSelectedSealed(product)}
              className="w-full flex items-center gap-4 bg-surface-800 border border-surface-700 hover:border-surface-500 rounded-xl px-4 py-3 text-left transition-all cursor-pointer"
            >
              <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-surface-700 border border-surface-600">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                    ?
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {product.name}
                </p>
                <p className="text-slate-500 text-xs truncate">
                  {product.setName}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-accent font-bold">
                  {fmtPrice(product.currentPrice)}
                </p>
                <p className="text-slate-600 text-xs mt-0.5">market</p>
              </div>
              <div className="flex-shrink-0 px-3 py-1.5 bg-blue-900/30 border border-blue-700/40 text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-900/50 transition-colors">
                Add
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Card results */}
      {!isSealed && cardResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {cardResults.length} result{cardResults.length !== 1 ? "s" : ""}
          </p>
          {cardResults.map((card) => (
            <TcgCardRow key={card.id} card={card} onDetail={setDetailCard} />
          ))}
        </div>
      )}

      {!hasQuery && !isFetching && (
        <div className="text-center py-16 text-slate-600 text-sm">
          Type at least 2 characters to search
        </div>
      )}

      {detailCard && (
        <TcgCardDetailModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
          onAdd={(card, section) => {
            setAddSection(section);
            setSelectedCard(card);
            setDetailCard(null);
          }}
        />
      )}

      {selectedCard && (
        <AddModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          defaultSection={addSection}
        />
      )}

      {selectedSealed && (
        <AddSealedModal
          product={selectedSealed}
          onClose={() => setSelectedSealed(null)}
        />
      )}
    </div>
  );
}
