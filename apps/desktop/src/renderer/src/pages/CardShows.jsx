import { useState, useEffect, useCallback, useRef } from "react";

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "N. Carolina" },
  { code: "ND", name: "N. Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "S. Carolina" },
  { code: "SD", name: "S. Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "W. Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const MONTH_IDX = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseShowDate(dateStr) {
  if (!dateStr) return null;
  const without = dateStr.replace(/^\w+,\s*/, "");
  const parts = without.split(/\s+/);
  const m = MONTH_IDX[parts[0]];
  const d = parseInt(parts[1]);
  const y = parseInt(parts[2]);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
  return new Date(y, m, d);
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildShowMap(shows) {
  const map = {};
  for (const show of shows) {
    const d = parseShowDate(show.date);
    if (!d) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!map[key]) map[key] = [];
    map[key].push(show);
  }
  return map;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function ShowCard({ show, distance, isGoing, onToggleGoing }) {
  const isClose = typeof distance === "number" && distance <= 10;

  return (
    <div
      className={`relative bg-surface-700 border rounded-xl p-3 flex flex-col gap-1.5 transition-colors ${
        isClose ? "border-yellow-500/60" : "border-surface-600"
      }`}
    >
      {isClose && (
        <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2.5 py-1 rounded-bl-lg rounded-tr-xl leading-none">
          ★ Close by
        </div>
      )}

      <p
        className={`text-white text-sm font-semibold leading-snug ${isClose ? "pr-16" : ""}`}
      >
        {show.name}
      </p>

      {(show.venue || show.address || show.cityState) && (
        <button
          onClick={() => {
            const query = [show.venue, show.address, show.cityState]
              .filter(Boolean)
              .join(", ");
            window.api.openExternal(
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
            );
          }}
          className="flex items-center gap-1 text-left group w-fit"
        >
          <svg
            className="w-3 h-3 flex-shrink-0 text-violet-400 group-hover:text-violet-300 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-xs text-violet-400 group-hover:text-violet-300 group-hover:underline transition-colors">
            {[show.venue, show.cityState].filter(Boolean).join(" — ")}
          </span>
        </button>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5">
          {show.time && (
            <span className="text-slate-400 text-xs flex items-center gap-1">
              <svg
                className="w-3 h-3 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {show.time}
            </span>
          )}
          {typeof distance === "number" && (
            <span className="text-slate-500 text-xs">
              {distance < 2 ? "< 2 mi" : `${Math.round(distance)} mi away`}
            </span>
          )}
        </div>
        <button
          onClick={() => onToggleGoing(show)}
          className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
            isGoing
              ? "bg-violet-700/60 border-violet-400 text-violet-100"
              : "bg-surface-600 border-surface-500 text-slate-400 hover:border-violet-500 hover:text-violet-300"
          }`}
        >
          <svg
            className="w-3.5 h-3.5"
            fill={isGoing ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          {isGoing ? "Going" : "Going?"}
        </button>
      </div>
    </div>
  );
}

function ShowRow({ show, onRemove, onShowClick, dimmed = false }) {
  return (
    <div className="relative">
      <button
        onClick={() => onShowClick?.(show)}
        className={`w-full rounded-lg px-2.5 py-2 pr-6 border text-left transition-colors ${
          dimmed
            ? "bg-surface-800/50 border-surface-700 hover:bg-surface-700/50"
            : "bg-surface-800 hover:bg-surface-700 border-surface-600 hover:border-violet-500/50"
        }`}
      >
        <p
          className={`text-xs font-medium leading-snug ${dimmed ? "text-slate-400" : "text-white"}`}
        >
          {show.name}
        </p>
        <p className="text-slate-500 text-[10px] mt-0.5 truncate">
          {show.cityState}
        </p>
        {show.time && <p className="text-slate-600 text-[10px]">{show.time}</p>}
      </button>
      <button
        onClick={() => onRemove(show.id)}
        className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors text-[10px] rounded"
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}

function UpcomingSidebar({ upcomingShows, onRemove, onShowClick }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [attendedOpen, setAttendedOpen] = useState(false);

  const upcoming = upcomingShows
    .filter((s) => {
      const d = parseShowDate(s.date);
      return d && d >= today;
    })
    .sort((a, b) => parseShowDate(a.date) - parseShowDate(b.date));

  const attended = upcomingShows
    .filter((s) => {
      const d = parseShowDate(s.date);
      return d && d < today;
    })
    .sort((a, b) => parseShowDate(b.date) - parseShowDate(a.date));

  const upcomingGroups = {};
  for (const show of upcoming) {
    if (!upcomingGroups[show.date])
      upcomingGroups[show.date] = { label: show.date, shows: [] };
    upcomingGroups[show.date].shows.push(show);
  }
  const groupList = Object.values(upcomingGroups);

  return (
    <div className="w-72 flex-shrink-0 border-r border-surface-700 flex flex-col overflow-hidden">
      <button
        onClick={() => setUpcomingOpen((o) => !o)}
        className="px-3 py-2.5 border-b border-surface-700 flex items-center gap-2 flex-shrink-0 w-full text-left hover:bg-surface-800/40 transition-colors"
      >
        <svg
          className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${upcomingOpen ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <svg
          className="w-4 h-4 text-violet-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="text-xs font-semibold text-slate-200 flex-1">
          My Upcoming Shows
        </span>
        {upcoming.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 bg-violet-900/60 text-violet-300 rounded-full font-medium">
            {upcoming.length}
          </span>
        )}
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 flex flex-col gap-3">
        {upcomingOpen &&
          (groupList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-3 text-center">
              <svg
                className="w-7 h-7 text-slate-700 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-slate-600 text-xs leading-snug">
                Click "Going?" on any show to add it here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupList.map((group) => (
                <div key={group.label}>
                  <p className="text-violet-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-1">
                    {group.label.replace(/^\w+,\s*/, "")}
                  </p>
                  <div className="space-y-1">
                    {group.shows.map((show) => (
                      <ShowRow
                        key={show.id}
                        show={show}
                        onRemove={onRemove}
                        onShowClick={onShowClick}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

        {attended.length > 0 && (
          <div className="border-t border-surface-700 pt-2">
            <button
              onClick={() => setAttendedOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-1 py-1 text-left"
            >
              <svg
                className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${attendedOpen ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex-1">
                Shows Attended
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-surface-700 text-slate-500 rounded-full font-medium">
                {attended.length}
              </span>
            </button>
            {attendedOpen && (
              <div className="space-y-1 mt-1">
                {attended.map((show) => (
                  <ShowRow
                    key={show.id}
                    show={show}
                    onRemove={onRemove}
                    onShowClick={onShowClick}
                    dimmed
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarView({
  shows,
  distances,
  upcomingShowIds,
  onToggleGoing,
  jumpToDate,
  noShows,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const showMap = buildShowMap(shows);

  const [selectedDate, setSelectedDate] = useState(() => {
    const key = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    return showMap[key] ? new Date(today) : null;
  });
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  useEffect(() => {
    if (!jumpToDate) return;
    const d = new Date(
      jumpToDate.getFullYear(),
      jumpToDate.getMonth(),
      jumpToDate.getDate(),
    );
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDate(d);
  }, [jumpToDate]);

  const minMonth = new Date(today.getFullYear(), 0, 1); // Jan 1 of current year

  function changeMonth(delta) {
    setCurrentMonth((m) => {
      const next = new Date(m.getFullYear(), m.getMonth() + delta, 1);
      return next < minMonth ? m : next;
    });
    setSelectedDate(null);
  }

  const atMinMonth = currentMonth <= minMonth;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedKey = selectedDate
    ? `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`
    : null;
  const selectedShows = selectedKey
    ? [...(showMap[selectedKey] || [])].sort((a, b) => {
        const da = distances[a.cityState];
        const db = distances[b.cityState];
        const hasA = typeof da === "number";
        const hasB = typeof db === "number";
        if (hasA && hasB) return da - db;
        if (hasA) return -1;
        if (hasB) return 1;
        return 0;
      })
    : [];

  const monthShowCount = Object.entries(showMap)
    .filter(([k]) => {
      const [y, m2] = k.split("-").map(Number);
      return y === year && m2 === month;
    })
    .reduce((s, [, arr]) => s + arr.length, 0);

  return (
    <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
      {/* Calendar */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <button
            onClick={() => changeMonth(-1)}
            disabled={atMinMonth}
            className="flex items-center gap-1 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 hover:text-white text-sm rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Prev
          </button>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <p className="text-white font-semibold">
                {MONTHS[month]} {year}
              </p>
              <button
                onClick={() => {
                  setCurrentMonth(
                    new Date(today.getFullYear(), today.getMonth(), 1),
                  );
                  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
                  setSelectedDate(showMap[todayKey] ? new Date(today) : null);
                }}
                className="text-[10px] px-1.5 py-0.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 hover:border-violet-500 text-slate-400 hover:text-violet-300 rounded transition-colors"
              >
                Today
              </button>
            </div>
            {noShows ? (
              <p className="text-[10px] text-slate-500 italic">
                No upcoming shows — check back later
              </p>
            ) : (
              monthShowCount > 0 && (
                <p className="text-violet-400 text-xs">
                  {monthShowCount} show{monthShowCount !== 1 ? "s" : ""}
                </p>
              )
            )}
          </div>
          <button
            onClick={() => changeMonth(1)}
            className="flex items-center gap-1 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 hover:text-white text-sm rounded-lg transition-colors"
          >
            Next
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1 flex-shrink-0">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="text-center text-xs font-medium text-slate-500 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <div
            className="grid grid-cols-7 gap-1 h-full"
            style={{ gridAutoRows: "1fr" }}
          >
            {cells.map((day, idx) => {
              if (!day)
                return (
                  <div key={idx} className="rounded-lg bg-surface-800/10" />
                );
              const cellDate = new Date(year, month, day);
              cellDate.setHours(0, 0, 0, 0);
              const isPast = cellDate < today;
              const isToday = sameDay(cellDate, today);
              const key = `${year}-${month}-${day}`;
              const dayShows = showMap[key] || [];
              const isSelected =
                selectedDate && sameDay(cellDate, selectedDate);

              const borderCls = isSelected
                ? "border-violet-400"
                : isToday
                  ? "border-violet-500"
                  : "border-surface-600";
              const bgCls = isSelected
                ? "bg-violet-900/30"
                : isToday
                  ? "bg-violet-900/10"
                  : "bg-surface-800/40";
              const dayNumCls = isSelected
                ? "text-violet-200 font-bold"
                : isToday
                  ? "text-violet-400 font-bold"
                  : isPast
                    ? "text-slate-600"
                    : "text-slate-400";

              return (
                <div
                  key={idx}
                  onClick={() =>
                    dayShows.length > 0 &&
                    setSelectedDate(isSelected ? null : cellDate)
                  }
                  className={[
                    "border rounded-lg p-1.5 flex flex-col overflow-hidden transition-colors",
                    dayShows.length > 0 ? "cursor-pointer" : "cursor-default",
                    borderCls,
                    bgCls,
                    !isSelected && dayShows.length > 0
                      ? "hover:bg-surface-700/50"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="flex items-center justify-between mb-1">
                    {isToday ? (
                      <span className="text-white text-[9px] font-semibold leading-none">
                        Today
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className={`text-xs ${dayNumCls}`}>{day}</span>
                  </div>

                  {dayShows.slice(0, 4).map((show, i) => {
                    const isClose =
                      typeof distances[show.cityState] === "number" &&
                      distances[show.cityState] <= 10;
                    return (
                      <div
                        key={show.id || i}
                        className={`text-[10px] leading-tight mb-0.5 rounded px-1 py-0.5 overflow-hidden flex items-center gap-1 ${
                          isPast
                            ? "bg-surface-700/50 text-slate-500"
                            : "bg-violet-900/50 text-violet-100"
                        }`}
                      >
                        {isClose && (
                          <span className="w-1.5 h-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
                        )}
                        <div className="font-medium truncate">{show.name}</div>
                      </div>
                    );
                  })}
                  {dayShows.length > 4 && (
                    <div className="text-[10px] text-slate-500 pl-1">
                      +{dayShows.length - 4}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day detail panel */}
      <div className="w-96 flex-shrink-0 flex flex-col min-h-0">
        {selectedDate ? (
          <div className="bg-surface-800 border border-violet-500/30 rounded-xl p-3 flex flex-col min-h-0">
            <div className="mb-2 flex-shrink-0">
              <p className="text-violet-400 text-[11px] font-medium uppercase tracking-wider">
                {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
              </p>
              <p className="text-white font-semibold text-sm">
                {selectedDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <p className="text-violet-300 text-[11px]">
                {selectedShows.length} show
                {selectedShows.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
              {selectedShows.map((show, i) => (
                <ShowCard
                  key={show.id || i}
                  show={show}
                  distance={distances[show.cityState]}
                  isGoing={upcomingShowIds.has(show.id)}
                  onToggleGoing={onToggleGoing}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-surface-800/40 border border-surface-700 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center h-48">
            <svg
              className="w-7 h-7 text-slate-600 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p className="text-slate-600 text-xs">
              Click a day to see its shows
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ListView({
  shows,
  distances,
  upcomingShowIds,
  onToggleGoing,
  noShows,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [filterClose, setFilterClose] = useState(false);
  const [closeMiles, setCloseMiles] = useState(10);

  function adjustMiles(delta) {
    setCloseMiles((m) => Math.max(1, m + delta));
  }

  function handleMilesInput(e) {
    const v = parseInt(e.target.value);
    if (!isNaN(v) && v >= 1) setCloseMiles(v);
    else if (e.target.value === "") setCloseMiles("");
  }

  function handleMilesBlur(e) {
    const v = parseInt(e.target.value);
    setCloseMiles(!isNaN(v) && v >= 1 ? v : 10);
  }

  const groups = {};
  for (const show of shows) {
    const d = parseShowDate(show.date);
    if (!d) continue;
    if (!groups[show.date])
      groups[show.date] = { date: d, label: show.date, shows: [] };
    groups[show.date].shows.push(show);
  }

  const milesLimit = typeof closeMiles === "number" ? closeMiles : 10;

  const sorted = Object.values(groups)
    .sort((a, b) => a.date - b.date)
    .map((group) => ({
      ...group,
      shows: filterClose
        ? group.shows.filter((s) => {
            const d = distances[s.cityState];
            return typeof d === "number" && d <= milesLimit;
          })
        : group.shows,
    }))
    .filter((group) => group.shows.length > 0);

  const hasDistances = Object.keys(distances).length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {/* Filter toolbar */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {noShows && (
          <span className="text-xs text-slate-500 italic">
            No upcoming shows — check back later
          </span>
        )}
        <button
          onClick={() => setFilterClose((f) => !f)}
          disabled={!hasDistances}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            filterClose
              ? "bg-violet-700/50 border-violet-400 text-violet-100"
              : "bg-surface-700 border-surface-500 text-slate-400 hover:border-violet-500/60 hover:text-violet-300"
          }`}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Close by only
        </button>

        <div
          className={`flex items-center gap-1 transition-opacity ${!hasDistances ? "opacity-40 pointer-events-none" : ""}`}
        >
          <button
            onClick={() => adjustMiles(-1)}
            className="w-6 h-6 flex items-center justify-center bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 rounded-md text-sm leading-none transition-colors"
          >
            −
          </button>
          <div className="flex items-center gap-1 bg-surface-700 border border-surface-500 rounded-md px-2 py-1">
            <input
              type="number"
              min="1"
              value={closeMiles}
              onChange={handleMilesInput}
              onBlur={handleMilesBlur}
              className="w-10 bg-transparent text-white text-xs text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-slate-400 text-xs">mi</span>
          </div>
          <button
            onClick={() => adjustMiles(1)}
            className="w-6 h-6 flex items-center justify-center bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 rounded-md text-sm leading-none transition-colors"
          >
            +
          </button>
        </div>

        {filterClose && sorted.length === 0 && hasDistances && (
          <span className="text-slate-500 text-xs">
            No shows within {milesLimit} mi
          </span>
        )}
        {!hasDistances && (
          <span className="text-slate-600 text-xs">
            Add a zip code in My Account to enable distance filtering
          </span>
        )}
      </div>

      <div className="space-y-5 overflow-y-auto flex-1 min-h-0 pr-1">
        {sorted.map((group) => {
          const isPast = group.date < today;
          return (
            <div key={group.label} className={isPast ? "opacity-40" : ""}>
              <div className="flex items-center gap-3 mb-2">
                <p
                  className={`text-sm font-semibold ${isPast ? "text-slate-500" : "text-violet-300"}`}
                >
                  {group.label}
                </p>
                <div className="flex-1 h-px bg-surface-700" />
                <span className="text-xs text-slate-500">
                  {group.shows.length} show{group.shows.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {group.shows.map((show, i) => (
                  <ShowCard
                    key={show.id || i}
                    show={show}
                    distance={distances[show.cityState]}
                    isGoing={upcomingShowIds.has(show.id)}
                    onToggleGoing={onToggleGoing}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CardShows() {
  const [selectedState, setSelectedState] = useState(null);
  const [defaultState, setDefaultState] = useState(null);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("calendar");
  const [upcomingShows, setUpcomingShows] = useState([]);
  const [distances, setDistances] = useState({});
  const [jumpToDate, setJumpToDate] = useState(null);
  const userLocRef = useRef(null);
  const geocodeCleanupRef = useRef(null);
  const pendingJumpRef = useRef(null);

  const loadState = useCallback(async (state) => {
    setSelectedState(state);
    setLoading(true);
    setError(null);
    setShows([]);
    setDistances({});
    if (geocodeCleanupRef.current) {
      geocodeCleanupRef.current();
      geocodeCleanupRef.current = null;
    }

    let loadedShows = [];
    try {
      const result = await window.api.getCardShows(state.code, state.name);
      loadedShows = result.shows || [];
      setShows(loadedShows);
      if (pendingJumpRef.current) {
        setJumpToDate(pendingJumpRef.current);
        pendingJumpRef.current = null;
      }
    } catch (err) {
      setError(`Failed to load card shows: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }

    // Geocode in background after shows are visible
    try {
      const settings = await window.api.getSettings();
      const zip = settings.profile?.zipCode;
      const uniqueCities = [
        ...new Set(loadedShows.map((s) => s.cityState).filter(Boolean)),
      ];

      if (uniqueCities.length === 0 && !zip) return;

      const batchResult = await window.api.getGeocodeBatch({
        zip,
        cities: uniqueCities,
      });

      if (batchResult.userLocation) {
        userLocRef.current = batchResult.userLocation;
        const initial = {};
        for (const [city, loc] of Object.entries(batchResult.cities)) {
          if (loc)
            initial[city] = haversineDistance(
              userLocRef.current.lat,
              userLocRef.current.lon,
              loc.lat,
              loc.lon,
            );
        }
        if (Object.keys(initial).length > 0) setDistances(initial);
      }
    } catch {
      // distance calc is best-effort
    }
  }, []);

  const goBackToStates = useCallback(() => {
    setSelectedState(null);
    setShows([]);
  }, []);

  useEffect(() => {
    window.api
      .getSettings()
      .then((s) => {
        if (s.defaultCardShowState) {
          setDefaultState(s.defaultCardShowState);
          loadState(s.defaultCardShowState);
        }
      })
      .catch(() => {});
    window.api
      .listUpcomingShows()
      .then(setUpcomingShows)
      .catch(() => {});

    return () => {
      if (geocodeCleanupRef.current) geocodeCleanupRef.current();
    };
  }, [loadState]);

  useEffect(() => {
    if (!selectedState) return;
    window.history.pushState({ pokeprice: "cardshows-state" }, "");
    const handlePopState = () => goBackToStates();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedState, goBackToStates]);

  async function handleSetDefault(state) {
    setDefaultState(state);
    await window.api.setSettings({ defaultCardShowState: state });
  }

  async function handleClearDefault() {
    setDefaultState(null);
    await window.api.setSettings({ defaultCardShowState: null });
  }

  async function toggleGoing(show) {
    const isGoing = upcomingShows.some((s) => s.id === show.id);
    if (isGoing) {
      await window.api.removeUpcomingShow(show.id);
      setUpcomingShows((prev) => prev.filter((s) => s.id !== show.id));
    } else {
      const showData = {
        ...show,
        stateCode: selectedState?.code,
        stateName: selectedState?.name,
      };
      await window.api.addUpcomingShow(showData);
      setUpcomingShows((prev) => [...prev, showData]);
    }
  }

  async function handleSidebarShowClick(show) {
    const date = parseShowDate(show.date);
    if (!date) return;
    setViewMode("calendar");
    if (selectedState?.code === show.stateCode) {
      setJumpToDate(new Date(date));
    } else {
      pendingJumpRef.current = new Date(date);
      const state = { code: show.stateCode, name: show.stateName };
      loadState(state);
    }
  }

  async function removeUpcoming(showId) {
    await window.api.removeUpcomingShow(showId);
    setUpcomingShows((prev) => prev.filter((s) => s.id !== showId));
  }

  const upcomingShowIds = new Set(upcomingShows.map((s) => s.id));
  const showsWithHistory = shows;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-surface-700 grid grid-cols-3 items-center gap-4">
        {/* Left: back button */}
        <div className="flex items-center">
          {selectedState && (
            <button
              onClick={() => {
                window.history.back();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-500 bg-surface-700 hover:bg-surface-600 hover:border-violet-500/60 text-slate-300 hover:text-violet-200 text-sm font-medium transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              States
            </button>
          )}
          {!selectedState && (
            <h2 className="text-base font-semibold text-white">Card Shows</h2>
          )}
        </div>

        {/* Center: state name + count */}
        <div className="flex items-center justify-center gap-2">
          {selectedState && (
            <>
              <h2 className="text-lg font-bold text-white">
                {selectedState.name}
              </h2>
              {!loading && (
                <span className="text-xs px-2 py-0.5 bg-violet-900/40 border border-violet-500/30 text-violet-300 rounded-full">
                  {showsWithHistory.length} show
                  {showsWithHistory.length !== 1 ? "s" : ""}
                </span>
              )}
            </>
          )}
        </div>

        {/* Right: default select + view toggle */}
        <div className="flex items-center gap-2 justify-end">
          <span className="text-slate-500 text-xs">Default:</span>
          <select
            value={defaultState?.code || ""}
            onChange={(e) => {
              const state =
                US_STATES.find((s) => s.code === e.target.value) || null;
              if (state) {
                handleSetDefault(state);
                loadState(state);
              } else handleClearDefault();
            }}
            className="bg-surface-700 border border-surface-500 text-xs text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-500 transition-colors"
          >
            <option value="">None</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>

          {selectedState && !loading && (
            <div className="flex border border-surface-600 rounded-lg overflow-hidden ml-1">
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === "calendar"
                    ? "bg-violet-700/50 text-violet-200"
                    : "bg-surface-700 text-slate-400 hover:text-white"
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-violet-700/50 text-violet-200"
                    : "bg-surface-700 text-slate-400 hover:text-white"
                }`}
              >
                List
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body: sidebar + main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <UpcomingSidebar
          upcomingShows={upcomingShows}
          onRemove={removeUpcoming}
          onShowClick={handleSidebarShowClick}
        />

        <div className="flex-1 min-h-0 overflow-hidden px-6 py-4 flex flex-col">
          {!selectedState && (
            <>
              <p className="text-slate-500 text-xs mb-4">
                Select a state to view upcoming card shows
              </p>
              <div className="grid grid-cols-10 gap-2">
                {US_STATES.map((state) => (
                  <button
                    key={state.code}
                    onClick={() => loadState(state)}
                    className={`h-16 flex flex-col items-center justify-center px-1 rounded-xl border transition-all group ${
                      defaultState?.code === state.code
                        ? "border-violet-500 bg-violet-900/30 text-violet-200"
                        : "border-surface-600 bg-surface-800 text-slate-400 hover:border-violet-500/60 hover:bg-violet-900/10 hover:text-violet-200"
                    }`}
                  >
                    <span className="text-lg font-bold leading-none">
                      {state.code}
                    </span>
                    <span className="text-[11px] mt-1 text-center leading-tight opacity-60 group-hover:opacity-100 transition-opacity w-full px-1 line-clamp-2">
                      {state.name}
                    </span>
                    {defaultState?.code === state.code && (
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">
                Loading shows for {selectedState?.name}…
              </p>
              <p className="text-slate-600 text-xs">
                First load takes a few seconds
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <p className="text-red-400 text-sm text-center max-w-md">
                {error}
              </p>
              <button
                onClick={() => loadState(selectedState)}
                className="px-4 py-2 bg-violet-700/30 hover:bg-violet-700/50 border border-violet-500/50 text-violet-300 text-sm rounded-lg transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {selectedState &&
            !loading &&
            !error &&
            (viewMode === "calendar" ? (
              <CalendarView
                shows={showsWithHistory}
                distances={distances}
                upcomingShowIds={upcomingShowIds}
                onToggleGoing={toggleGoing}
                jumpToDate={jumpToDate}
                noShows={showsWithHistory.length === 0}
              />
            ) : (
              <ListView
                shows={showsWithHistory}
                distances={distances}
                upcomingShowIds={upcomingShowIds}
                onToggleGoing={toggleGoing}
                noShows={showsWithHistory.length === 0}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
