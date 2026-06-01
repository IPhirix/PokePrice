const DEFAULT_PLACEHOLDER = 'Search by name, set, or card # (e.g. Charizard #4)…'

export default function CardSearchInput({
  query,
  onChange,
  onSearch,
  searching,
  autoFocus,
  inputRef,
  disabled,
  placeholder = DEFAULT_PLACEHOLDER,
  rightSlot,
  inputClassName = '',
}) {
  return (
    <div className="flex gap-1.5">
      <input
        ref={inputRef}
        value={query}
        onChange={onChange}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={`flex-1 bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent disabled:opacity-50 ${inputClassName}`}
      />
      <button
        onClick={onSearch}
        disabled={searching || !query.trim() || disabled}
        title="Search"
        className="px-3 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-black font-bold rounded-lg text-sm transition-colors flex items-center gap-1.5 flex-shrink-0"
      >
        {searching ? (
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
        )}
        <span>{searching ? 'Searching' : 'Search'}</span>
      </button>
      {rightSlot}
    </div>
  )
}
