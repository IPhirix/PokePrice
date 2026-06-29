"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/react";
import { ConditionBadge } from "@pokeprice/ui";
import type { Card, CardCondition } from "@pokeprice/types";

type GradableCondition = Exclude<CardCondition, "sealed">;

function fmt(n: number | null | undefined, withSign = false) {
  if (n == null) return "—";
  const abs =
    "$" +
    Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (!withSign) return n < 0 ? "-" + abs : abs;
  return (n >= 0 ? "+" : "-") + abs;
}

const CONDITIONS = [
  { value: "raw", label: "Raw" },
  { value: "psa10", label: "PSA 10" },
  { value: "psa9", label: "PSA 9" },
  { value: "psa8", label: "PSA 8" },
  { value: "cgc10", label: "CGC 10" },
  { value: "cgc9", label: "CGC 9" },
] as const;

function PriceHistoryChart({
  history,
}: {
  history: { date: string; price: number }[];
}) {
  if (history.length < 2) {
    return (
      <div className="h-40 flex items-center justify-center text-slate-600 text-sm">
        Not enough price history yet
      </div>
    );
  }

  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const W = 800;
  const H = 160;
  const PAD = 12;

  const pts = history.map((p, i) => {
    const x = PAD + (i / (history.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (p.price - min) / range) * (H - PAD * 2);
    return [x, y] as [number, number];
  });

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = [
    `M${pts[0][0]},${H}`,
    pts.map(([x, y]) => `L${x},${y}`).join(" "),
    `L${pts[pts.length - 1][0]},${H}`,
    "Z",
  ].join(" ");

  const first = history[0];
  const last = history[history.length - 1];
  const isUp = last.price >= first.price;
  const stroke = isUp ? "#34d399" : "#f87171";
  const fillId = `chart-fill-${isUp ? "up" : "dn"}`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height: 160 }}
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.15" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${fillId})`} />
        <polyline
          points={polyline}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={pts[pts.length - 1][0]}
          cy={pts[pts.length - 1][1]}
          r="4"
          fill={stroke}
        />
      </svg>
      <div className="flex justify-between text-xs text-slate-600 mt-2 px-1">
        <span>{first.date}</span>
        <span
          className={`font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}
        >
          {isUp ? "▲" : "▼"}{" "}
          {Math.abs(((last.price - first.price) / first.price) * 100).toFixed(
            1,
          )}
          % over period
        </span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}

// ── Edit Panel ────────────────────────────────────────────────────────────────
function EditPanel({ card, onClose }: { card: Card; onClose: () => void }) {
  const [quantity, setQuantity] = useState(String(card.quantity));
  const [condition, setCondition] = useState<GradableCondition>(
    card.condition as GradableCondition,
  );
  const [purchasePrice, setPurchasePrice] = useState(
    card.purchasePrice != null ? String(card.purchasePrice) : "",
  );
  const [binder, setBinder] = useState(card.binder ?? "");
  const [targetBuy, setTargetBuy] = useState(
    card.targetBuyPrice != null ? String(card.targetBuyPrice) : "",
  );
  const [targetSell, setTargetSell] = useState(
    card.targetSellPrice != null ? String(card.targetSellPrice) : "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [movingTo, setMovingTo] = useState<"portfolio" | "watchlist" | null>(
    null,
  );

  const utils = trpc.useUtils();
  const updateCard = trpc.cards.update.useMutation({
    onSuccess: () => {
      utils.portfolio.dashboard.invalidate();
      utils.cards.getById.invalidate(card.id);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });
  const moveSection = trpc.cards.moveSection.useMutation({
    onSuccess: (result) => {
      utils.portfolio.dashboard.invalidate();
      if (result.ok && result.newId) {
        window.location.href = `/card/${result.newId}`;
      }
    },
  });

  const { data: profile } = trpc.profiles.get.useQuery();
  const binderOptions = profile?.binderLists ?? [];

  function save() {
    setSaving(true);
    updateCard.mutate({
      id: card.id,
      quantity: parseInt(quantity) || 1,
      condition,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      binder: binder || null,
      targetBuyPrice: targetBuy ? parseFloat(targetBuy) : null,
      targetSellPrice: targetSell ? parseFloat(targetSell) : null,
    });
  }

  const labelCls = "text-xs text-slate-500 mb-1 block";
  const inputCls =
    "w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent hover:border-surface-500 transition-colors";
  const selectCls = inputCls;

  return (
    <div className="bg-surface-800 border border-surface-600 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Edit Card
        </h2>
        {saved && (
          <span className="text-xs text-emerald-400 font-medium">Saved</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Quantity */}
        <div>
          <label className={labelCls}>Quantity</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Condition */}
        <div>
          <label className={labelCls}>Condition</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as GradableCondition)}
            className={selectCls}
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Purchase Price */}
        <div>
          <label className={labelCls}>Purchase Price</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Binder */}
        <div>
          <label className={labelCls}>Binder</label>
          {binderOptions.length > 0 ? (
            <select
              value={binder}
              onChange={(e) => setBinder(e.target.value)}
              className={selectCls}
            >
              <option value="">— None —</option>
              {binderOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="Binder name"
              value={binder}
              onChange={(e) => setBinder(e.target.value)}
              className={inputCls}
            />
          )}
        </div>
      </div>

      {/* Price Alerts */}
      <div className="border-t border-surface-600 pt-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Price Alerts
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              <span className="text-emerald-500">↓</span> Buy Below
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="—"
              value={targetBuy}
              onChange={(e) => setTargetBuy(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              <span className="text-red-500">↑</span> Sell Above
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="—"
              value={targetSell}
              onChange={(e) => setTargetSell(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 bg-accent hover:bg-amber-400 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>

        <button
          onClick={() => {
            const to = card.section === "portfolio" ? "watchlist" : "portfolio";
            setMovingTo(to);
            moveSection.mutate({ id: card.id, toSection: to });
          }}
          disabled={moveSection.isPending}
          className="flex items-center gap-1.5 px-3 py-2 bg-surface-700 border border-surface-600 hover:border-surface-500 text-slate-400 hover:text-white text-sm rounded-lg transition-all disabled:opacity-50"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          {moveSection.isPending
            ? `Moving to ${movingTo}…`
            : `Move to ${card.section === "portfolio" ? "Watchlist" : "Collection"}`}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CardDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const {
    data: card,
    isLoading,
    error,
  } = trpc.cards.getById.useQuery(id, { staleTime: 60_000 });
  const { data: history = [] } = trpc.prices.history.useQuery(id, {
    staleTime: 60_000,
    enabled: !!card,
  });

  const utils = trpc.useUtils();
  const removeCard = trpc.cards.remove.useMutation({
    onSuccess: () => {
      utils.portfolio.dashboard.invalidate();
      router.push("/");
    },
  });
  const refreshPrice = trpc.prices.refreshSingle.useMutation({
    onSuccess: () => {
      utils.cards.getById.invalidate(id);
      utils.prices.history.invalidate(id);
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4 animate-pulse">
        <div className="h-5 w-24 bg-surface-700 rounded" />
        <div className="h-52 bg-surface-800 rounded-2xl" />
        <div className="h-52 bg-surface-800 rounded-2xl" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-6">
        <button
          onClick={() => router.back()}
          className="text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1.5 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>
        <div className="bg-surface-800 border border-red-900/40 rounded-2xl p-6">
          <p className="text-red-400 font-medium mb-1">Card not found</p>
          <p className="text-slate-500 text-sm">
            {error?.message ?? "This card could not be loaded."}
          </p>
        </div>
      </div>
    );
  }

  const gain =
    card.currentPrice != null && card.purchasePrice != null
      ? card.currentPrice - card.purchasePrice
      : null;
  const gainPct =
    gain != null && card.purchasePrice
      ? (gain / card.purchasePrice) * 100
      : null;
  const isUp = gain == null ? true : gain >= 0;
  const cardTable = card.section === "portfolio" ? "collections" : "watchlists";

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to {card.section === "watchlist" ? "Watchlist" : "Collection"}
      </button>

      {/* Hero card */}
      <div className="bg-surface-800 border border-surface-600 rounded-2xl p-5 flex gap-5">
        {/* Image */}
        <div className="w-28 h-40 flex-shrink-0 rounded-xl overflow-hidden bg-surface-700 ring-1 ring-surface-600 shadow-lg">
          {card.imageUrlLarge || card.imageUrl ? (
            <Image
              src={card.imageUrlLarge ?? card.imageUrl!}
              alt={card.name}
              width={112}
              height={160}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-600 text-3xl">
              ?
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">
                {card.name}
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                {card.setName ?? "—"}
                {card.number ? ` · #${card.number}` : ""}
                {card.rarity ? ` · ${card.rarity}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ConditionBadge condition={card.condition} />
              {/* Edit toggle */}
              <button
                onClick={() => setShowEdit((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium rounded-lg transition-all ${
                  showEdit
                    ? "bg-accent/20 border-accent/50 text-accent"
                    : "bg-surface-700 border-surface-600 text-slate-400 hover:text-white hover:border-surface-500"
                }`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                Edit
              </button>
              {/* Refresh price */}
              <button
                onClick={() => refreshPrice.mutate({ cardId: id, cardTable })}
                disabled={refreshPrice.isPending}
                title="Refresh price"
                className="p-1.5 bg-surface-700 border border-surface-600 text-slate-400 hover:text-white hover:border-surface-500 rounded-lg transition-all disabled:opacity-50"
              >
                <svg
                  className={`w-3.5 h-3.5 ${refreshPrice.isPending ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Price hero */}
          <div className="flex items-end gap-6 mt-4">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Current Price</p>
              <p className="text-4xl font-bold text-white">
                {fmt(card.currentPrice)}
              </p>
            </div>

            {gain != null && (
              <div className="mb-1">
                <p className="text-xs text-slate-500 mb-0.5">Gain / Loss</p>
                <p
                  className={`text-xl font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}
                >
                  {fmt(gain, true)}
                </p>
                {gainPct != null && (
                  <p
                    className={`text-xs ${isUp ? "text-emerald-500/70" : "text-red-500/70"}`}
                  >
                    {gainPct >= 0 ? "+" : ""}
                    {gainPct.toFixed(1)}% ROI
                  </p>
                )}
              </div>
            )}

            {/* Price changes */}
            <div className="flex gap-4 mb-1 ml-auto">
              {[
                { label: "1D", pct: card.changeDay },
                { label: "1W", pct: card.changeWeek },
                { label: "1M", pct: card.changeMonth },
              ].map(({ label, pct }) => (
                <div key={label} className="text-center">
                  <p
                    className={`text-sm font-semibold ${
                      pct == null
                        ? "text-slate-600"
                        : pct >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                    }`}
                  >
                    {pct == null
                      ? "—"
                      : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
                  </p>
                  <p className="text-[10px] text-slate-600">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick meta */}
          <div className="flex gap-4 mt-4 text-xs text-slate-500">
            {card.purchasePrice != null && (
              <span>
                Cost basis:{" "}
                <span className="text-slate-300">
                  {fmt(card.purchasePrice)}
                </span>
              </span>
            )}
            {card.quantity > 1 && (
              <span>
                Qty: <span className="text-slate-300">{card.quantity}</span>
              </span>
            )}
            {card.binder && (
              <span>
                Binder: <span className="text-slate-300">{card.binder}</span>
              </span>
            )}
            <span>
              Section:{" "}
              <span className="text-slate-300 capitalize">{card.section}</span>
            </span>
            {card.lastPriceUpdate && (
              <span>
                Updated:{" "}
                <span className="text-slate-300">
                  {card.lastPriceUpdate.slice(0, 10)}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Edit Panel */}
      {showEdit && <EditPanel card={card} onClose={() => setShowEdit(false)} />}

      {/* Price chart */}
      <div className="bg-surface-800 border border-surface-600 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Price History
        </h2>
        <PriceHistoryChart history={history} />
      </div>

      {/* Alerts display (read-only summary) */}
      {(card.targetBuyPrice != null || card.targetSellPrice != null) && (
        <div className="bg-surface-800 border border-surface-600 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Active Price Alerts
            </h2>
            <button
              onClick={() => setShowEdit(true)}
              className="text-xs text-slate-500 hover:text-accent transition-colors"
            >
              Edit alerts
            </button>
          </div>
          <div className="flex gap-4">
            {card.targetBuyPrice != null && (
              <div className="flex-1 bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3">
                <p className="text-xs text-emerald-600 mb-1">↓ Buy Below</p>
                <p className="text-white font-semibold">
                  {fmt(card.targetBuyPrice)}
                </p>
                {card.currentPrice != null && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {card.currentPrice <= card.targetBuyPrice ? (
                      <span className="text-emerald-400">● Triggered</span>
                    ) : (
                      `${fmt(card.currentPrice - card.targetBuyPrice)} above target`
                    )}
                  </p>
                )}
              </div>
            )}
            {card.targetSellPrice != null && (
              <div className="flex-1 bg-red-900/20 border border-red-700/30 rounded-xl p-3">
                <p className="text-xs text-red-500 mb-1">↑ Sell Above</p>
                <p className="text-white font-semibold">
                  {fmt(card.targetSellPrice)}
                </p>
                {card.currentPrice != null && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {card.currentPrice >= card.targetSellPrice ? (
                      <span className="text-red-400">● Triggered</span>
                    ) : (
                      `${fmt(card.targetSellPrice - card.currentPrice)} below target`
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Danger Zone
        </h2>
        {confirmRemove ? (
          <div className="flex items-center gap-3">
            <p className="text-slate-400 text-sm flex-1">
              Remove <span className="text-white font-medium">{card.name}</span>{" "}
              permanently?
            </p>
            <button
              onClick={() => setConfirmRemove(false)}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-surface-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => removeCard.mutate(id)}
              disabled={removeCard.isPending}
              className="px-3 py-1.5 text-sm bg-red-900/60 border border-red-500/40 text-red-400 rounded-lg hover:bg-red-900/80 transition-colors disabled:opacity-50"
            >
              {removeCard.isPending ? "Removing…" : "Yes, Remove"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            className="px-4 py-2 bg-surface-700 border border-surface-600 hover:border-red-500/40 hover:text-red-400 text-slate-400 rounded-lg text-sm font-medium transition-all"
          >
            Remove Card
          </button>
        )}
      </div>
    </div>
  );
}
