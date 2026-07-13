import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import BinderSelector from "./BinderSelector";
import { useCardSearch } from "../hooks/useCardSearch";
import CardSearchInput from "./CardSearchInput";
import { sortAndFormatSets, filterSets } from "../utils/setDropdown";
import {
  isSealedProductQuery,
  normalizeForSealedSearch,
  parseSealedProducts,
} from "../utils/sealedSearch";
import { filterValidVariations } from "../utils/cardVariations";

const CONDITIONS = [
  { value: "raw", label: "Raw" },
  { value: "psa10", label: "PSA 10" },
  { value: "psa9", label: "PSA 9" },
  { value: "psa8", label: "PSA 8" },
  { value: "cgc10", label: "CGC 10" },
  { value: "cgc9", label: "CGC 9" },
];

function parseCardNum(str) {
  if (!str) return Infinity;
  const m = str.split("/")[0].match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : Infinity;
}

export default function CardSearch({ section, onAdd, onClose }) {
  const navigate = useNavigate();
  const [allSets, setAllSets] = useState([]);
  const [setQuery, setSetQuery] = useState("");
  const [setSearch, setSetSearch] = useState("");
  const [setDropdownOpen, setSetDropdownOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState("default");
  const setDropdownRef = useRef(null);

  const extraQuery = setQuery ? `set.name:"${setQuery}"` : "";

  const {
    query,
    results,
    searching,
    searchCommitted,
    displayCount,
    error: searchError,
    handleQueryChange,
    handleSearch,
    loadMore,
  } = useCardSearch({ initialPageSize: 40, pageIncrement: 20, extraQuery });
  const [selected, setSelected] = useState(null);
  const [condition, setCondition] = useState("raw");
  const [binder, setBinder] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [alertPrice, setAlertPrice] = useState("");
  const [addedDate, setAddedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [variations, setVariations] = useState([]);
  const [variationStep, setVariationStep] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [sealedResults, setSealedResults] = useState([]);
  const [sealedSearching, setSealedSearching] = useState(false);
  const [sealedCommitted, setSealedCommitted] = useState(false);
  const [selectedSealed, setSelectedSealed] = useState(null);

  const inputRef = useRef(null);
  const binderRef = useRef(null);

  const isSealedQuery = isSealedProductQuery(query.trim());

  const sectionLabel = section === "collection" ? "Collection" : "Watchlist";

  const processedSets = useMemo(() => sortAndFormatSets(allSets), [allSets]);
  const filteredSets = useMemo(
    () => filterSets(processedSets, setSearch),
    [processedSets, setSearch],
  );
  const selectedSetDisplay = useMemo(
    () => processedSets.find((s) => s.name === setQuery)?.display ?? setQuery,
    [processedSets, setQuery],
  );

  const sortedResults = useMemo(() => {
    if (sortOrder === "default") return results;
    return [...results].sort((a, b) => {
      if (a._divider || b._divider) return 0;
      if (sortOrder === "name")
        return (a.name || "").localeCompare(b.name || "");
      if (sortOrder === "set")
        return (
          (a.set?.name || "").localeCompare(b.set?.name || "") ||
          parseCardNum(a.number) - parseCardNum(b.number)
        );
      if (sortOrder === "number_asc")
        return parseCardNum(a.number) - parseCardNum(b.number);
      if (sortOrder === "number_desc")
        return parseCardNum(b.number) - parseCardNum(a.number);
      return 0;
    });
  }, [results, sortOrder]);

  useEffect(() => {
    inputRef.current?.focus();
    window.api.getSettings().then((s) => {
      if (s.defaultCondition) setCondition(s.defaultCondition);
    });
    window.api
      .listSets()
      .then(setAllSets)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        setDropdownRef.current &&
        !setDropdownRef.current.contains(e.target)
      ) {
        setSetDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function doSearch() {
    setSelected(null);
    setSelectedSealed(null);
    setError(null);
    if (isSealedQuery) {
      setSealedResults([]);
      setSealedCommitted(true);
      setSealedSearching(true);
      try {
        const response = await window.api.searchSealed(query.trim());
        setSealedResults(parseSealedProducts(response));
      } catch {
        setError("Sealed product search failed.");
      } finally {
        setSealedSearching(false);
      }
    } else {
      setSealedResults([]);
      setSealedCommitted(false);
      await handleSearch();
    }
  }

  function goToAdvancedSearch() {
    onClose();
    navigate("/", {
      state: { tab: "search", searchQuery: query.trim() || undefined },
    });
  }

  async function selectCardAndCheckVariations(card) {
    if (selected?.id === card.id) {
      setSelected(null);
      setVariationStep(false);
      setVariations([]);
      setSelectedVariation(null);
      return;
    }
    setSelected(card);
    setVariations([]);
    setSelectedVariation(null);
    setVariationStep(false);
    setLoadingVariations(true);
    try {
      const vars = await window.api.getCardVariations(
        card.name,
        card.number || "",
        card.set?.name || "",
      );
      const validVars = filterValidVariations(vars);
      if (validVars.length > 1) {
        setVariations(validVars);
        setVariationStep(true);
      } else {
        setSelectedVariation(validVars[0] || null);
      }
    } catch (e) {
      console.warn("[CardSearch] getCardVariations failed:", e?.message);
    }
    setLoadingVariations(false);
  }

  async function handleAddSealed() {
    if (!selectedSealed) return;
    setAdding(true);
    try {
      const effectiveBinder =
        ((await binderRef.current?.ensureAndGetBinder()) ?? binder) || null;
      const parsedPrice =
        purchasePrice !== "" ? parseFloat(purchasePrice) : null;
      await window.api.addSealedProduct(
        selectedSealed,
        section,
        parsedPrice && parsedPrice > 0 ? parsedPrice : null,
        effectiveBinder,
      );
      onAdd();
      onClose();
    } catch {
      setError("Failed to add sealed product.");
      setAdding(false);
    }
  }

  async function handleAddCard() {
    if (!selected) return;
    setAdding(true);
    try {
      const effectiveBinder =
        ((await binderRef.current?.ensureAndGetBinder()) ?? binder) || null;
      const parsedPrice =
        purchasePrice !== "" ? parseFloat(purchasePrice) : null;
      const newCard = await window.api.addCard(
        {
          ...selected,
          pricechartingId: selectedVariation?.pricecharting_id || null,
          pricechartingName: selectedVariation?.product_name || null,
        },
        condition,
        1,
        section,
        parsedPrice && parsedPrice > 0 ? parsedPrice : null,
        effectiveBinder,
        addedDate || null,
      );
      const targets = {};
      const parsedAlert = alertPrice !== "" ? parseFloat(alertPrice) : null;
      if (parsedAlert != null && parsedAlert > 0) {
        targets.alertPrice = Math.round(parsedAlert * 100) / 100;
        const history = await window.api.getPriceHistory(newCard.id);
        const latestPrice = history[history.length - 1]?.price;
        if (latestPrice != null) {
          targets.alertPct =
            Math.round(
              ((targets.alertPrice - latestPrice) / latestPrice) * 1000,
            ) / 10;
        }
      }
      if (Object.keys(targets).length > 0 && newCard?.id) {
        await window.api.updateCard(newCard.id, targets);
      }
      onAdd();
      onClose();
    } catch {
      setError("Failed to add card.");
      setAdding(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && !adding && onClose()}
      onKeyDown={(e) => e.key === "Escape" && !adding && onClose()}
    >
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-3xl mx-4 flex flex-col h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-surface-600">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Add Item</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                Adding to{" "}
                <span
                  className={
                    section === "collection" ? "text-accent" : "text-sky-400"
                  }
                >
                  {sectionLabel}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={adding}
              className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center disabled:opacity-30"
            >
              ✕
            </button>
          </div>

          {/* Single search bar */}
          <CardSearchInput
            query={query}
            onChange={handleQueryChange}
            onSearch={doSearch}
            searching={searching}
            disabled={adding}
            inputRef={inputRef}
            rightSlot={
              <button
                onClick={goToAdvancedSearch}
                title="Advanced search — open full search page"
                className="px-2.5 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 hover:border-surface-400 text-slate-400 hover:text-white rounded-lg transition-colors flex items-center flex-shrink-0"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              </button>
            }
          />

          {/* Set filter + sort row */}
          <div className="flex gap-2 mt-2">
            {/* Set name dropdown */}
            <div className="flex-1 relative" ref={setDropdownRef}>
              <button
                type="button"
                disabled={adding}
                onClick={() => {
                  setSetDropdownOpen((v) => !v);
                  setSetSearch("");
                }}
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none hover:border-surface-400 disabled:opacity-40"
              >
                <span className={setQuery ? "text-white" : "text-slate-500"}>
                  {selectedSetDisplay || "Any set…"}
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${setDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {setDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-surface-700 border border-surface-500 rounded-lg shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-surface-600">
                    <input
                      autoFocus
                      value={setSearch}
                      onChange={(e) => setSetSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setSetDropdownOpen(false);
                      }}
                      placeholder="Search sets…"
                      className="w-full bg-surface-800 border border-surface-600 rounded px-2.5 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSetQuery("");
                        setSetDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-surface-600 hover:text-white transition-colors"
                    >
                      Any set
                    </button>
                    {filteredSets.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSetQuery(s.name);
                          setSetDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-600 transition-colors ${setQuery === s.name ? "text-accent" : "text-white"}`}
                      >
                        <span className="truncate">{s.display}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sort order */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              disabled={adding}
              className="bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent disabled:opacity-40 flex-shrink-0"
            >
              <option value="default">Default order</option>
              <option value="name">Name (A → Z)</option>
              <option value="set">Set</option>
              <option value="number_asc">Number (Low → High)</option>
              <option value="number_desc">Number (High → Low)</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div
          className="flex-1 overflow-y-auto min-h-0"
          onScroll={(e) => {
            const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
            if (
              scrollHeight - scrollTop - clientHeight < 150 &&
              displayCount < results.length
            ) {
              loadMore();
            }
          }}
        >
          {/* Sealed product results */}
          {isSealedQuery && sealedSearching && (
            <div className="flex items-center justify-center p-10 text-slate-400 text-base">
              Searching sealed products...
            </div>
          )}
          {isSealedQuery &&
            !sealedSearching &&
            sealedResults.length === 0 &&
            sealedCommitted && (
              <div className="p-10 text-slate-500 text-base text-center">
                No sealed products found
              </div>
            )}
          {isSealedQuery &&
            !sealedSearching &&
            sealedResults.map((product) => {
              const productName =
                product.name || product["product-name"] || "Unknown";
              const category =
                product.setName || product["console-name"] || "Sealed Product";
              const isSelected = selectedSealed?.id === product.id;
              return (
                <button
                  key={product.id}
                  onClick={() =>
                    !adding && setSelectedSealed(isSelected ? null : product)
                  }
                  className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-surface-700 transition-colors text-left ${
                    isSelected ? "bg-surface-700 border-l-2 border-accent" : ""
                  }`}
                >
                  <div className="w-16 h-[88px] flex-shrink-0 bg-surface-700 rounded flex items-center justify-center text-slate-600 overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={productName}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextElementSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      style={{ display: product.imageUrl ? "none" : "flex" }}
                      className="w-full h-full items-center justify-center"
                    >
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-base font-semibold truncate">
                      {productName}
                    </p>
                    <p className="text-slate-400 text-sm mt-0.5">{category}</p>
                    {product.prices?.market != null && (
                      <p className="text-accent text-sm font-bold mt-0.5">
                        ${product.prices.market.toFixed(2)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}

          {/* Card results — hidden when sealed query */}
          {!isSealedQuery && searching && (
            <div className="flex items-center justify-center p-10 text-slate-400 text-base">
              Searching...
            </div>
          )}
          {!isSealedQuery && searchError && (
            <div className="p-5 text-red-400 text-base text-center">
              {searchError}
            </div>
          )}
          {!isSealedQuery &&
            !searching &&
            !searchError &&
            results.length === 0 &&
            searchCommitted && (
              <div className="p-10 text-slate-500 text-base text-center">
                No cards found
              </div>
            )}
          {!isSealedQuery && !searching && !searchError && !searchCommitted && (
            <div className="flex flex-col items-center justify-center p-12 text-slate-700 gap-2">
              <svg
                className="w-10 h-10 text-slate-800"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"
                />
              </svg>
              <p className="text-sm">Search to find a card</p>
            </div>
          )}
          {!isSealedQuery &&
            searchCommitted &&
            sortedResults.slice(0, displayCount).map((card) => {
              if (card._divider) {
                return (
                  <div
                    key="__divider__"
                    className="flex items-center gap-3 px-6 py-2 select-none"
                  >
                    <div className="flex-1 h-px bg-surface-600" />
                    <span className="text-xs text-slate-500 font-medium">
                      Similar Items
                    </span>
                    <div className="flex-1 h-px bg-surface-600" />
                  </div>
                );
              }
              return (
                <button
                  key={card.id}
                  onClick={() =>
                    !adding &&
                    !loadingVariations &&
                    selectCardAndCheckVariations(card)
                  }
                  className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-surface-700 transition-colors text-left ${
                    selected?.id === card.id
                      ? "bg-surface-700 border-l-2 border-accent"
                      : ""
                  }`}
                >
                  <div className="w-16 h-[88px] flex-shrink-0">
                    {card.images?.small ? (
                      <img
                        src={card.images.small}
                        alt={card.name}
                        className="w-full h-full object-contain rounded"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextElementSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      style={{ display: card.images?.small ? "none" : "flex" }}
                      className="w-full h-full bg-surface-700 rounded flex-col items-center justify-center text-slate-600 gap-0.5"
                    >
                      <svg className="w-8 h-10" viewBox="0 0 28 36" fill="none">
                        <rect
                          x="1"
                          y="1"
                          width="26"
                          height="34"
                          rx="3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="14"
                          cy="15"
                          r="5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M5 28 Q14 22 23 28"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="text-[9px]">No image</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-base font-semibold truncate">
                      {card.name}
                      {card.number ? (
                        <span className="text-slate-400 font-normal">
                          {" "}
                          #{card.number}
                        </span>
                      ) : (
                        ""
                      )}
                    </p>
                    <p className="text-slate-300 text-sm mt-0.5">
                      {[card.set?.series, card.set?.name]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                    {card.rarity && (
                      <p className="text-slate-500 text-sm mt-0.5">
                        {card.rarity}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          {!isSealedQuery &&
            searchCommitted &&
            !searching &&
            sortedResults.length > displayCount && (
              <p className="text-center text-slate-600 text-xs py-3">
                Showing {displayCount} of {sortedResults.length} — scroll for
                more
              </p>
            )}
        </div>

        {/* Selected sealed product add form */}
        {selectedSealed && (
          <div className="flex-shrink-0 border-t border-surface-600 bg-surface-900/50">
            {adding ? (
              <div className="p-8 flex flex-col items-center justify-center gap-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-surface-600 border-t-accent animate-spin" />
                </div>
                <p className="text-white font-semibold text-base">
                  {selectedSealed.name}
                </p>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-surface-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-base font-semibold">
                      {selectedSealed.name}
                    </p>
                    <p className="text-slate-400 text-sm">
                      {selectedSealed.setName || "Sealed Product"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <label className="text-slate-400 text-sm mb-1.5 block">
                      Binder (optional)
                    </label>
                    <BinderSelector
                      ref={binderRef}
                      section={section}
                      value={binder}
                      onChange={setBinder}
                      className="w-full"
                    />
                  </div>
                  {section === "collection" && (
                    <div className="w-40">
                      <label className="text-slate-400 text-sm mb-1.5 block">
                        Price Paid (optional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                          $
                        </span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={purchasePrice}
                          onChange={(e) => setPurchasePrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  )}
                </div>
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <button
                  onClick={handleAddSealed}
                  className={`w-full text-black font-bold py-3 rounded-lg text-base transition-colors ${
                    section === "collection"
                      ? "bg-accent hover:bg-accent-hover"
                      : "bg-sky-500 hover:bg-sky-400"
                  }`}
                >
                  Add to {sectionLabel}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Selected card + variation picker / add form */}
        {(selected || loadingVariations) && (
          <div className="flex-shrink-0 border-t border-surface-600 bg-surface-900/50 overflow-y-auto">
            {loadingVariations ? (
              <div className="p-6 flex items-center justify-center gap-3 text-slate-400 text-sm">
                <svg
                  className="animate-spin w-4 h-4 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Looking up variations…
              </div>
            ) : variationStep ? (
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-4 mb-1">
                  <img
                    src={selected?.images?.small}
                    className="w-12 h-[66px] object-contain rounded flex-shrink-0"
                    alt={selected?.name}
                  />
                  <div>
                    <p className="text-white text-base font-semibold">
                      {selected?.name}
                    </p>
                    <p className="text-slate-400 text-sm">
                      {selected?.set?.name}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300 mb-0.5">
                    Which variation?
                  </p>
                  <p className="text-xs text-slate-500 mb-3">
                    Multiple versions found — pick the one you have.
                  </p>
                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                    {variations.map((v) => (
                      <button
                        key={v.pricecharting_id}
                        onClick={() => {
                          setSelectedVariation(v);
                          setVariationStep(false);
                        }}
                        className="w-full text-left px-3 py-2.5 bg-surface-800 hover:bg-surface-700 border border-surface-600 hover:border-accent rounded-lg transition-colors"
                      >
                        <p className="text-white text-sm">{v.product_name}</p>
                        <p className="text-slate-500 text-xs">
                          {v.console_name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={() => {
                      setSelectedVariation(null);
                      setVariationStep(false);
                    }}
                    className="w-full px-3 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 hover:border-surface-400 text-slate-300 text-sm rounded-lg transition-colors"
                  >
                    Not sure — skip for now
                  </button>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setVariationStep(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors text-center py-1"
                  >
                    ← Back to results
                  </button>
                </div>
              </div>
            ) : adding ? (
              <div className="p-8 flex flex-col items-center justify-center gap-4">
                <div className="relative w-16 h-16">
                  {selected?.images?.small && (
                    <img
                      src={selected.images.small}
                      alt={selected.name}
                      className="w-12 h-[66px] object-contain rounded absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80"
                    />
                  )}
                  <div className="absolute inset-0 rounded-full border-4 border-surface-600 border-t-accent animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-base">
                    {selected?.name}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    Fetching current price data…
                  </p>
                  <div className="flex items-center justify-center gap-1.5 mt-3">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={selected?.images?.small}
                    className="w-14 h-[78px] object-contain rounded flex-shrink-0"
                    alt={selected?.name}
                  />
                  <div>
                    <p className="text-white text-base font-semibold">
                      {selected?.name}
                    </p>
                    <p className="text-slate-400 text-sm mt-0.5">
                      {selected?.set?.name}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <label className="text-slate-400 text-sm mb-1.5 block">
                      Condition
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-slate-400 text-sm mb-1.5 block">
                      Binder (optional)
                    </label>
                    <BinderSelector
                      ref={binderRef}
                      section={section}
                      value={binder}
                      onChange={setBinder}
                      className="w-full"
                    />
                  </div>
                  <div className="w-44">
                    <label className="text-slate-400 text-sm mb-1.5 block">
                      Added to Collection
                    </label>
                    <input
                      type="date"
                      value={addedDate}
                      onChange={(e) => setAddedDate(e.target.value)}
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-base text-white focus:outline-none focus:border-accent [color-scheme:dark]"
                    />
                  </div>
                  {section === "collection" && (
                    <div className="w-40">
                      <label className="text-slate-400 text-sm mb-1.5 block">
                        Price Paid (optional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                          $
                        </span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={purchasePrice}
                          onChange={(e) => setPurchasePrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="text-accent text-sm mb-1.5 block font-medium">
                    Price Alert (optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                      $
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={alertPrice}
                      onChange={(e) => setAlertPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <button
                  onClick={handleAddCard}
                  className={`w-full text-black font-bold py-3 rounded-lg text-base transition-colors ${
                    section === "collection"
                      ? "bg-accent hover:bg-accent-hover"
                      : "bg-sky-500 hover:bg-sky-400"
                  }`}
                >
                  Add to {sectionLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
