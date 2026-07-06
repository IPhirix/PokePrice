// Fills any missing calendar days in a sorted price history by carrying the
// last known price forward. Charts space x-axis ticks by array index, not by
// date, so a history with skipped days (a stale refresh, a day the source had
// no snapshot) renders unevenly spaced ticks unless gaps are filled first.
export function fillDailyGaps(entries) {
  if (!entries || entries.length < 2) return entries || [];
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const filled = [];
  let last = entries[0];
  const cursor = new Date(entries[0].date + "T12:00:00Z");
  const end = new Date(entries[entries.length - 1].date + "T12:00:00Z");
  while (cursor <= end) {
    const date = cursor.toISOString().split("T")[0];
    const existing = byDate.get(date);
    if (existing) {
      last = existing;
      filled.push(existing);
    } else {
      filled.push({ ...last, date });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return filled;
}
