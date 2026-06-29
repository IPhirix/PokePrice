"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { trpc } from "@/trpc/react";
import type { Card } from "@pokeprice/types";
import Sparkline from "./Sparkline";
import { AlertBellBadge } from "./AlertBellBadge";

// ── Condition labels + colors (exact desktop CONDITION_COLOR) ─────────────────
const COND_LABEL: Record<string, string> = {
  raw: "Raw",
  psa10: "PSA 10",
  psa9: "PSA 9",
  psa8: "PSA 8",
  cgc10: "CGC 10",
  cgc9: "CGC 9",
  sealed: "Sealed",
};
const COND_COLOR: Record<string, string> = {
  raw: "bg-slate-700 text-slate-300",
  psa10: "bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40",
  psa9: "bg-zinc-500/50 text-zinc-100",
  psa8: "bg-orange-800/60 text-orange-300",
  cgc10: "bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40",
  cgc9: "bg-zinc-500/50 text-zinc-100",
  sealed: "bg-blue-900/60 text-blue-200 ring-1 ring-blue-500/40",
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return (
    "$" +
    Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// Vertical divider between row sections (matches desktop Divider component)
function Divider() {
  return (
    <div className="self-stretch flex items-center flex-shrink-0">
      <div className="w-px h-10 bg-surface-600 rounded-full" />
    </div>
  );
}

// 1D/1W/1M change indicator
function PctChange({
  value,
  label,
}: {
  value: number | null | undefined;
  label: string;
}) {
  const color =
    value == null
      ? "text-slate-600"
      : value > 0
        ? "text-emerald-400"
        : value < 0
          ? "text-red-400"
          : "text-slate-500";
  const pct =
    value == null ? "—" : (value > 0 ? "+" : "") + value.toFixed(1) + "%";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-slate-600 w-4 flex-shrink-0">
        {label}
      </span>
      <span className={`text-xs font-semibold tabular-nums ${color}`}>
        {pct}
      </span>
    </div>
  );
}

// Remove button with desktop-style confirm popup
function RemoveButton({ card }: { card: Card }) {
  const [confirming, setConfirming] = useState(false);
  const utils = trpc.useUtils();
  const remove = trpc.cards.remove.useMutation({
    onSuccess: () => utils.portfolio.dashboard.invalidate(),
  });

  return (
    <div
      className="flex-shrink-0 self-stretch flex flex-col items-center justify-center relative"
      onClick={(e) => e.stopPropagation()}
    >
      {confirming && (
        <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 flex items-center gap-2 z-10 whitespace-nowrap shadow-xl">
          <span className="text-slate-300 text-xs font-medium">
            Remove card?
          </span>
          <button
            onClick={() => remove.mutate(card.id)}
            disabled={remove.isPending}
            className="bg-red-700 hover:bg-red-600 text-white text-xs px-2.5 py-1 rounded font-semibold transition-colors"
          >
            {remove.isPending ? "…" : "Remove"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-slate-500 hover:text-white text-base leading-none px-1"
          >
            ✕
          </button>
        </div>
      )}
      <button
        onClick={() => setConfirming(true)}
        className="text-slate-600 hover:text-red-400 transition-colors text-xl leading-none"
        title="Remove card"
      >
        ✕
      </button>
    </div>
  );
}

// ── Table row (compact, matches desktop table view) ───────────────────────────
function TableRow({
  card,
  bulkMode,
  selected,
  onToggleSelect,
}: {
  card: Card;
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const condLabel = COND_LABEL[card.condition] ?? card.condition;
  const condColor = COND_COLOR[card.condition] ?? "bg-slate-700 text-slate-300";
  const hasHistory = card.recentHistory.length >= 2;
  const historyValues = card.recentHistory.map((h) => h.price);
  const isUp = hasHistory
    ? historyValues[historyValues.length - 1] >= historyValues[0]
    : true;

  return (
    <div
      className={`flex items-center gap-2.5 bg-surface-800 border rounded-xl px-4 py-3 transition-all cursor-pointer ${
        selected
          ? "border-accent/60 bg-accent/5"
          : "border-surface-700 hover:border-surface-500 hover:bg-surface-700/50"
      }`}
      onClick={() => bulkMode && onToggleSelect?.(card.id)}
    >
      {bulkMode && (
        <div
          className="flex-shrink-0 w-4 h-4 rounded border-2 border-surface-500 flex items-center justify-center"
          style={{
            borderColor: selected ? "#f59e0b" : undefined,
            background: selected ? "#f59e0b22" : undefined,
          }}
        >
          {selected && (
            <svg
              className="w-3 h-3 text-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      )}
      <div
        className={`flex-shrink-0 rounded overflow-hidden ${card.type === "sealed" ? "w-12 h-12" : "w-8 h-12"}`}
      >
        {card.imageUrl && (
          <Image
            src={card.imageUrl}
            alt={card.name}
            width={48}
            height={48}
            className="w-full h-full object-contain"
            unoptimized
          />
        )}
      </div>
      <Divider />
      <div className="w-52 flex-shrink-0 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight truncate">
          {card.name}
        </p>
        <p className="text-[11px] text-slate-500 truncate mt-0.5">
          {card.setName ?? "—"}
        </p>
      </div>
      <Divider />
      <div className="w-14 flex-shrink-0 flex items-center justify-center">
        <span
          className={`text-[10px] px-1.5 py-px rounded-full font-semibold whitespace-nowrap ${condColor}`}
        >
          {condLabel}
        </span>
      </div>
      <Divider />
      <div className="flex items-center gap-1.5 flex-shrink-0 w-56">
        {[
          { label: "1D", value: card.changeDay },
          { label: "1W", value: card.changeWeek },
          { label: "1M", value: card.changeMonth },
        ].map(({ label, value }) => {
          const color =
            value == null
              ? "text-slate-600"
              : value > 0
                ? "text-emerald-400"
                : value < 0
                  ? "text-red-400"
                  : "text-slate-500";
          const bg =
            value == null
              ? "bg-surface-700"
              : value > 0
                ? "bg-emerald-400/10"
                : value < 0
                  ? "bg-red-400/10"
                  : "bg-slate-700/40";
          return (
            <span
              key={label}
              className={`flex-1 text-xs font-semibold py-1 rounded text-center ${color} ${bg}`}
            >
              {label}{" "}
              {value == null
                ? "—"
                : (value > 0 ? "+" : "") + value.toFixed(1) + "%"}
            </span>
          );
        })}
      </div>
      <Divider />
      <div className="flex-1 h-12 min-w-[80px]">
        {hasHistory ? (
          <Sparkline
            data={historyValues}
            width={200}
            height={48}
            color={isUp ? "#34d399" : "#f87171"}
            fill
            strokeWidth={1.5}
          />
        ) : (
          <div className="w-full border-t border-surface-700 border-dashed mt-6" />
        )}
      </div>
      <Divider />
      <div className="w-28 text-right flex-shrink-0">
        <p className="text-accent font-bold text-base leading-tight">
          {fmt(card.currentPrice)}
        </p>
        {card.purchasePrice != null && (
          <p className="text-slate-500 text-xs mt-0.5">
            Paid {fmt(card.purchasePrice)}
          </p>
        )}
      </div>
      {!bulkMode && <RemoveButton card={card} />}
    </div>
  );
}

// ── Card row (detailed view, mirrors desktop CardRow exactly) ─────────────────
function CardRow({
  card,
  bulkMode,
  selected,
  onToggleSelect,
}: {
  card: Card;
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const condLabel = COND_LABEL[card.condition] ?? card.condition;
  const condColor = COND_COLOR[card.condition] ?? "bg-slate-700 text-slate-300";
  const marketPrice = card.currentPrice ?? null;
  const purchasePrice = card.purchasePrice ?? null;
  const profit =
    marketPrice != null && purchasePrice != null
      ? marketPrice - purchasePrice
      : null;
  const hasHistory = card.recentHistory.length >= 2;
  const historyValues = card.recentHistory.map((h) => h.price);
  const isUp = hasHistory
    ? historyValues[historyValues.length - 1] >= historyValues[0]
    : true;
  const isUpAlert =
    card.targetSellPrice != null &&
    marketPrice != null &&
    marketPrice >= card.targetSellPrice;
  const isDownAlert =
    card.targetBuyPrice != null &&
    marketPrice != null &&
    marketPrice <= card.targetBuyPrice;

  return (
    <div
      className={`flex items-center gap-4 bg-surface-800 border rounded-xl px-4 py-3 transition-all group cursor-pointer ${
        selected
          ? "border-accent/60 bg-accent/5"
          : "border-surface-700 hover:border-surface-500 hover:bg-surface-700/50"
      }`}
      onClick={() => bulkMode && onToggleSelect?.(card.id)}
    >
      {bulkMode && (
        <div
          className="flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center flex-col"
          style={{
            borderColor: selected ? "#f59e0b" : "#475569",
            background: selected ? "#f59e0b22" : undefined,
          }}
        >
          {selected && (
            <svg
              className="w-3 h-3 text-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      )}

      {/* Card image */}
      <Link
        href={`/card/${card.id}`}
        onClick={(e) => {
          e.stopPropagation();
        }}
        className={`flex-shrink-0 flex items-center justify-center w-16 rounded-xl overflow-hidden border-2 border-transparent ${card.type === "sealed" ? "h-16" : "self-stretch"}`}
      >
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            width={64}
            height={card.type === "sealed" ? 64 : 90}
            className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-200"
            unoptimized
          />
        ) : (
          <div className="text-slate-600 text-xs text-center px-2">
            No image
          </div>
        )}
      </Link>

      <Divider />

      {/* Card identity — w-64 */}
      <Link
        href={`/card/${card.id}`}
        className="w-64 flex-shrink-0 min-w-0 flex flex-col justify-between self-stretch py-0.5"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-white font-bold text-sm leading-tight truncate">
            {card.name}
          </span>
          {card.number && (
            <span className="text-slate-500 text-xs flex-shrink-0">
              #{card.number}
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${condColor}`}
          >
            {condLabel}
          </span>
        </div>
        <p className="text-slate-400 text-xs truncate">{card.setName ?? "—"}</p>
        {card.addedDate && (
          <p className="text-slate-600 text-xs">
            Added {card.addedDate.slice(0, 10)}
          </p>
        )}
        {card.quantity > 1 && (
          <p className="text-slate-600 text-xs">Qty: {card.quantity}</p>
        )}
      </Link>

      <Divider />

      {/* 1D / 1W / 1M changes — w-28 */}
      <div className="flex flex-col gap-2 w-28 flex-shrink-0">
        <PctChange value={card.changeDay} label="1D" />
        <PctChange value={card.changeWeek} label="1W" />
        <PctChange value={card.changeMonth} label="1M" />
      </div>

      <Divider />

      {/* Sparkline — flex-1 */}
      <div className="flex-1 self-stretch min-h-0 min-w-[80px]">
        {hasHistory ? (
          <div className="w-full h-full">
            <Sparkline
              data={historyValues}
              width={300}
              height={72}
              color={isUp ? "#34d399" : "#f87171"}
              fill
              strokeWidth={1.5}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center">
            <div className="w-full border-t border-surface-700 border-dashed" />
          </div>
        )}
      </div>

      <Divider />

      {/* Alert section — w-24 */}
      <div
        className="w-24 flex-shrink-0 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Link
          href={`/card/${card.id}`}
          className={`relative w-full flex items-center justify-center gap-1.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            isUpAlert
              ? "bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/30 text-emerald-400"
              : isDownAlert
                ? "bg-red-400/10 hover:bg-red-400/20 border border-red-400/30 text-red-400"
                : card.targetSellPrice != null
                  ? "bg-accent/10 hover:bg-accent/20 border border-accent/30 text-white"
                  : "bg-surface-700 hover:bg-surface-600 border border-surface-600 text-white"
          }`}
        >
          <AlertBellBadge isUpAlert={isUpAlert} isDownAlert={isDownAlert} />
          <svg
            className="w-3.5 h-3.5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill={card.targetSellPrice != null ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {card.targetSellPrice != null ? "Edit $ Alert" : "Set $ Alert"}
        </Link>
        {card.targetSellPrice != null && (
          <p className="text-accent text-sm font-bold text-center">
            {fmt(card.targetSellPrice)}
          </p>
        )}
      </div>

      <Divider />

      {/* Pricing — w-36 text-right */}
      <div className="w-36 flex-shrink-0 text-right">
        <div className="space-y-1.5">
          {purchasePrice != null && (
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="text-slate-500 text-xs shrink-0">Paid</span>
              <span className="text-white font-bold text-xl leading-tight">
                {fmt(purchasePrice)}
              </span>
            </div>
          )}
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="text-slate-500 text-xs shrink-0">Market</span>
            <span className="text-accent font-bold text-xl leading-tight">
              {fmt(marketPrice)}
            </span>
          </div>
          {profit != null && (
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="text-slate-500 text-xs shrink-0">P&L</span>
              <span
                className={`font-bold text-xl leading-tight ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {profit >= 0 ? "+" : "−"}
                {fmt(Math.abs(profit))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Remove */}
      <RemoveButton card={card} />
    </div>
  );
}

// ── Collapsible section header (matches desktop exactly) ──────────────────────
function SectionHeader({
  label,
  count,
  collapsed,
  onToggle,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-3 mb-3">
      <div className="flex-1 h-px bg-surface-700" />
      <span className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors whitespace-nowrap">
        <svg
          className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${collapsed ? "-rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {label}
        <span className="text-xs px-1.5 py-0.5 bg-surface-700 rounded-full text-slate-400">
          {count}
        </span>
      </span>
      <div className="flex-1 h-px bg-surface-700" />
    </button>
  );
}

// Compact row for sold/traded cards
function SoldRow({ card }: { card: SoldCardItem }) {
  const condLabel = COND_LABEL[card.condition] ?? card.condition;
  const condColor = COND_COLOR[card.condition] ?? "bg-slate-700 text-slate-300";
  return (
    <div className="flex items-center gap-4 bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 opacity-70">
      {card.imageUrl ? (
        <img
          src={card.imageUrl}
          alt={card.name}
          className="w-10 h-14 object-contain flex-shrink-0 rounded"
        />
      ) : (
        <div className="w-10 h-14 flex-shrink-0 bg-surface-700 rounded flex items-center justify-center text-slate-600 text-xs">
          ?
        </div>
      )}
      <Divider />
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate">{card.name}</p>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${condColor}`}
        >
          {condLabel}
        </span>
      </div>
      <Divider />
      <div className="text-right flex-shrink-0">
        {card.salePrice != null && (
          <p className="text-emerald-400 font-bold text-lg">
            {fmt(card.salePrice)}
          </p>
        )}
        {card.purchasePrice != null && (
          <p className="text-slate-500 text-xs">
            Paid {fmt(card.purchasePrice)}
          </p>
        )}
        <p className="text-slate-600 text-xs">
          {card.isTrade ? "Trade" : "Sold"}
          {card.saleDate ? ` · ${card.saleDate}` : ""}
        </p>
      </div>
    </div>
  );
}

type SoldCardItem = {
  id: string;
  name: string;
  setName: string | null;
  condition: string;
  type: string;
  imageUrl: string | null;
  purchasePrice: number | null;
  salePrice: number | null;
  saleDate: string | null;
  isTrade: boolean;
  addedDate: string;
};

// ── Main list ─────────────────────────────────────────────────────────────────
export default function CardList({
  cards,
  soldCards = [],
  viewMode = "detailed",
  bulkMode = false,
  selected = new Set<string>(),
  onToggleSelect,
  emptyMessage = "No cards yet.",
}: {
  cards: Card[];
  soldCards?: SoldCardItem[];
  viewMode?: "detailed" | "table";
  bulkMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  emptyMessage?: string;
}) {
  const [cardsCollapsed, setCardsCollapsed] = useState(false);
  const [sealedCollapsed, setSealedCollapsed] = useState(false);
  const [soldCollapsed, setSoldCollapsed] = useState(true);

  const regularCards = cards.filter((c) => c.type !== "sealed");
  const sealedCards = cards.filter((c) => c.type === "sealed");

  if (cards.length === 0 && soldCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-600">
        <p className="text-base mb-1">No cards yet</p>
        <p className="text-sm text-slate-700">{emptyMessage}</p>
      </div>
    );
  }

  function renderCard(card: Card) {
    const rowProps = {
      card,
      bulkMode,
      selected: selected.has(card.id),
      onToggleSelect,
    };
    return viewMode === "table" ? (
      <TableRow key={card.id} {...rowProps} />
    ) : (
      <CardRow key={card.id} {...rowProps} />
    );
  }

  return (
    <div className="px-6 py-3">
      {/* ── Cards section ── */}
      <SectionHeader
        label="Cards"
        count={regularCards.length}
        collapsed={cardsCollapsed}
        onToggle={() => setCardsCollapsed((v) => !v)}
      />
      {!cardsCollapsed &&
        (regularCards.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="space-y-3 min-w-[760px]">
              {regularCards.map(renderCard)}
            </div>
          </div>
        ) : (
          <p className="text-slate-600 text-sm text-center py-4">
            {emptyMessage}
          </p>
        ))}

      {/* ── Sealed Products section ── */}
      <div className="mt-6 mb-2">
        <SectionHeader
          label="Sealed Products"
          count={sealedCards.length}
          collapsed={sealedCollapsed}
          onToggle={() => setSealedCollapsed((v) => !v)}
        />
        {!sealedCollapsed &&
          (sealedCards.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="space-y-3 min-w-[760px]">
                {sealedCards.map(renderCard)}
              </div>
            </div>
          ) : (
            <p className="text-slate-600 text-sm text-center py-4">
              No sealed products yet. Add an ETB, booster box, or other sealed
              product.
            </p>
          ))}
      </div>

      {/* ── Traded / Sold section ── */}
      <div className="mt-6 mb-2">
        <SectionHeader
          label="Traded / Sold"
          count={soldCards.length}
          collapsed={soldCollapsed}
          onToggle={() => setSoldCollapsed((v) => !v)}
        />
        {!soldCollapsed &&
          (soldCards.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="space-y-3 min-w-[760px]">
                {soldCards.map((card) => (
                  <SoldRow key={card.id} card={card} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-slate-600 text-sm text-center py-4">
              Once you make a trade or a sale, your cards will appear here.
            </p>
          ))}
      </div>
    </div>
  );
}
