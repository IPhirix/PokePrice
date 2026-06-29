export default function AlertBellButton({
  alertPrice,
  isUpAlert,
  isDownAlert,
  onClick,
}) {
  const isAlerted = isUpAlert || isDownAlert;
  const dotColor = isUpAlert ? "bg-emerald-400" : "bg-red-400";

  const btnClass = isUpAlert
    ? "bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/30 text-emerald-400"
    : isDownAlert
      ? "bg-red-400/10 hover:bg-red-400/20 border border-red-400/30 text-red-400"
      : alertPrice != null
        ? "bg-accent/10 hover:bg-accent/20 border border-accent/30 text-white"
        : "bg-surface-700 hover:bg-surface-600 border border-surface-600 text-white";

  return (
    <button
      onClick={onClick}
      title={alertPrice != null ? "Edit price alert" : "Set price alert"}
      className={`w-full relative flex items-center justify-center gap-1.5 py-1 rounded-lg text-xs font-medium transition-colors ${btnClass}`}
    >
      {isAlerted && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`}
          />
        </span>
      )}
      <svg
        className="w-3.5 h-3.5 flex-shrink-0"
        viewBox="0 0 24 24"
        fill={alertPrice != null ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {alertPrice != null ? "Edit $ Alert" : "Set $ Alert"}
    </button>
  );
}
