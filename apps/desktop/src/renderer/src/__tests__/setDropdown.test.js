/**
 * TDD tests for set dropdown formatting, sorting, and filtering.
 * Written before the implementation — these define the contract.
 *
 * Requirements:
 *  - Each set displays as "Series - Set Name" (e.g. "Sword & Shield - Lost Origin")
 *  - Dropdown sorted alphabetically by that display string
 *  - Search filters by the full display string (series OR set name match)
 */

import {
  formatSetDisplay,
  sortAndFormatSets,
  filterSets,
} from "../utils/setDropdown";

// ── formatSetDisplay ─────────────────────────────────────────────────────────

describe("formatSetDisplay", () => {
  it('combines series and name with " - " separator', () => {
    expect(
      formatSetDisplay({ name: "Lost Origin", series: "Sword & Shield" }),
    ).toBe("Sword & Shield - Lost Origin");
  });

  it("handles sets where series equals name (base Scarlet & Violet set)", () => {
    expect(
      formatSetDisplay({
        name: "Scarlet & Violet",
        series: "Scarlet & Violet",
      }),
    ).toBe("Scarlet & Violet - Scarlet & Violet");
  });

  it("returns just the name when series is empty string", () => {
    expect(formatSetDisplay({ name: "Base Set", series: "" })).toBe("Base Set");
  });

  it("returns just the name when series is null", () => {
    expect(formatSetDisplay({ name: "Jungle", series: null })).toBe("Jungle");
  });

  it("returns just the name when series is undefined", () => {
    expect(formatSetDisplay({ name: "Fossil", series: undefined })).toBe(
      "Fossil",
    );
  });

  it("preserves ampersands and special characters", () => {
    expect(formatSetDisplay({ name: "151", series: "Scarlet & Violet" })).toBe(
      "Scarlet & Violet - 151",
    );
  });
});

// ── sortAndFormatSets ────────────────────────────────────────────────────────

describe("sortAndFormatSets", () => {
  const unsorted = [
    { id: "swsh11", name: "Lost Origin", series: "Sword & Shield" },
    { id: "sv3pt5", name: "151", series: "Scarlet & Violet" },
    { id: "sv1", name: "Scarlet & Violet", series: "Scarlet & Violet" },
    { id: "base1", name: "Base Set", series: "Base" },
    { id: "swsh1", name: "Sword & Shield", series: "Sword & Shield" },
  ];

  it('sorts alphabetically by "Series - Name" display string', () => {
    const sorted = sortAndFormatSets(unsorted);
    const displays = sorted.map((s) => s.display);
    expect(displays).toEqual([...displays].sort((a, b) => a.localeCompare(b)));
  });

  it("Scarlet & Violet series sorts before Sword & Shield", () => {
    const sorted = sortAndFormatSets(unsorted);
    const svIndex = sorted.findIndex((s) => s.series === "Scarlet & Violet");
    const swshIndex = sorted.findIndex((s) => s.series === "Sword & Shield");
    expect(svIndex).toBeLessThan(swshIndex);
  });

  it("attaches a display property to every set", () => {
    const sorted = sortAndFormatSets(unsorted);
    expect(
      sorted.every(
        (s) => typeof s.display === "string" && s.display.length > 0,
      ),
    ).toBe(true);
  });

  it("does not mutate the input array", () => {
    const input = [
      { id: "b", name: "Z Set", series: "Z Series" },
      { id: "a", name: "A Set", series: "A Series" },
    ];
    const originalOrder = input.map((s) => s.id);
    sortAndFormatSets(input);
    expect(input.map((s) => s.id)).toEqual(originalOrder);
  });

  it("returns empty array for empty input", () => {
    expect(sortAndFormatSets([])).toEqual([]);
  });

  it('display for "151" set is "Scarlet & Violet - 151"', () => {
    const sorted = sortAndFormatSets(unsorted);
    const set151 = sorted.find((s) => s.name === "151");
    expect(set151?.display).toBe("Scarlet & Violet - 151");
  });
});

// ── filterSets ───────────────────────────────────────────────────────────────

describe("filterSets", () => {
  const formatted = [
    {
      id: "swsh11",
      name: "Lost Origin",
      series: "Sword & Shield",
      display: "Sword & Shield - Lost Origin",
    },
    {
      id: "sv3pt5",
      name: "151",
      series: "Scarlet & Violet",
      display: "Scarlet & Violet - 151",
    },
    {
      id: "sv1",
      name: "Scarlet & Violet",
      series: "Scarlet & Violet",
      display: "Scarlet & Violet - Scarlet & Violet",
    },
    {
      id: "base1",
      name: "Base Set",
      series: "Base",
      display: "Base - Base Set",
    },
  ];

  it("returns all sets when query is empty", () => {
    expect(filterSets(formatted, "")).toHaveLength(4);
  });

  it("filters by set name (partial match)", () => {
    const result = filterSets(formatted, "lost");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("swsh11");
  });

  it("filters by series name", () => {
    const result = filterSets(formatted, "sword");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("swsh11");
  });

  it("matches multiple sets with shared series prefix", () => {
    const result = filterSets(formatted, "scarlet");
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toContain("sv3pt5");
    expect(result.map((s) => s.id)).toContain("sv1");
  });

  it("is case insensitive", () => {
    expect(filterSets(formatted, "LOST ORIGIN")).toHaveLength(1);
    expect(filterSets(formatted, "sword & shield")).toHaveLength(1);
  });

  it("matches by full display string", () => {
    expect(filterSets(formatted, "Sword & Shield - Lost Origin")).toHaveLength(
      1,
    );
  });

  it("returns empty array when no sets match", () => {
    expect(filterSets(formatted, "zzz nonexistent")).toHaveLength(0);
  });
});
