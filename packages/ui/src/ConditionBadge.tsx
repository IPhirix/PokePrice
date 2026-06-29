export const CONDITION_LABEL: Record<string, string> = {
  raw:    'Raw',
  psa10:  'PSA 10',
  psa9:   'PSA 9',
  psa8:   'PSA 8',
  cgc10:  'CGC 10',
  cgc9:   'CGC 9',
  sealed: 'Sealed',
}

export const CONDITION_COLOR: Record<string, string> = {
  raw:    'bg-slate-700 text-slate-300',
  psa10:  'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  psa9:   'bg-zinc-500/50 text-zinc-100',
  psa8:   'bg-orange-800/60 text-orange-300',
  cgc10:  'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  cgc9:   'bg-zinc-500/50 text-zinc-100',
  sealed: 'bg-blue-900/60 text-blue-200 ring-1 ring-blue-500/40',
}

export default function ConditionBadge({ condition }: { condition: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${CONDITION_COLOR[condition] ?? 'bg-slate-700 text-slate-300'}`}>
      {CONDITION_LABEL[condition] ?? condition}
    </span>
  )
}
