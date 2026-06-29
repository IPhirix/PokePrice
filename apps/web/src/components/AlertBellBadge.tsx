interface Props {
  isUpAlert: boolean;
  isDownAlert: boolean;
}

export function AlertBellBadge({ isUpAlert, isDownAlert }: Props) {
  if (!isUpAlert && !isDownAlert) return null;
  const color = isUpAlert ? "bg-emerald-400" : "bg-red-400";
  return (
    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color}`}
      />
      <span
        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`}
      />
    </span>
  );
}
