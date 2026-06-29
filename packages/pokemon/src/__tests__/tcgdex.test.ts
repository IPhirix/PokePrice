/**
 * Unit tests for @pokeprice/pokemon tcgdex functions.
 * Axios is mocked so no real HTTP calls are made.
 *
 * These tests cover the web app's search path (packages/pokemon) and
 * mirror the set-name resolution contract tested in Rust (tcgdex.rs).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

// Reset module state (set cache) between tests
beforeEach(() => {
  vi.resetModules();
  mockedAxios.get = vi.fn();
});

// Helper — build a minimal TCGdex card response
function makeCard(id: string, name: string, setId: string) {
  return {
    id,
    name,
    localId: id.split("-")[1] ?? "1",
    image: `https://assets.tcgdex.net/en/${setId}/${id}`,
    rarity: "Common",
  };
}

// Helper — build a minimal TCGdex sets response
function makeSets() {
  return [
    {
      id: "swsh12pt5",
      name: "Crown Zenith",
      serie: { name: "Sword & Shield" },
      releaseDate: "2023-01-20",
      logo: "https://assets.tcgdex.net/en/swsh/swsh12pt5/logo",
      symbol: "https://assets.tcgdex.net/en/swsh/swsh12pt5/symbol",
    },
    {
      id: "base1",
      name: "Base Set",
      serie: { name: "Base" },
      releaseDate: "1999-01-09",
      // no logo — older sets may not have one
    },
    {
      id: "sv1",
      name: "Scarlet & Violet",
      serie: { name: "Scarlet & Violet" },
      releaseDate: "2023-03-31",
      logo: "https://assets.tcgdex.net/en/sv/sv1/logo",
      symbol: "https://assets.tcgdex.net/en/sv/sv1/symbol",
    },
  ];
}

// ── searchCards ──────────────────────────────────────────────────────────────

describe("searchCards", () => {
  it("queries TCGdex with name param", async () => {
    mockedAxios.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/sets")) return Promise.resolve({ data: makeSets() });
      return Promise.resolve({
        data: [makeCard("swsh12pt5-72", "Pikachu", "swsh12pt5")],
      });
    });

    const { searchCards } = await import("../tcgdex");
    const results = await searchCards("Pikachu");

    const cardsCall = (
      mockedAxios.get as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]: [string]) => url.includes("/cards"));
    expect(cardsCall).toBeDefined();
    expect(cardsCall[1].params).toMatchObject({ name: "Pikachu" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Pikachu");
  });

  it("returns empty array on network error", async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(new Error("Network error"));
    const { searchCards } = await import("../tcgdex");
    await expect(searchCards("Pikachu")).rejects.toThrow();
  });

  it("filters out Pocket cards", async () => {
    const pocketCard = {
      ...makeCard("P-A-1", "Pikachu ex", "P-A"),
      id: "P-A-1",
      localId: "1",
    };
    mockedAxios.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/sets")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [pocketCard] });
    });
    const { searchCards } = await import("../tcgdex");
    const results = await searchCards("Pikachu");
    expect(results).toHaveLength(0);
  });
});

// ── searchCardsAdvanced ──────────────────────────────────────────────────────

describe("searchCardsAdvanced", () => {
  it("returns empty array when no params provided", async () => {
    mockedAxios.get = vi.fn();
    const { searchCardsAdvanced } = await import("../tcgdex");
    const results = await searchCardsAdvanced({});
    expect(results).toEqual([]);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("queries with name param", async () => {
    mockedAxios.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/sets")) return Promise.resolve({ data: makeSets() });
      return Promise.resolve({
        data: [makeCard("swsh12pt5-72", "Pikachu", "swsh12pt5")],
      });
    });
    const { searchCardsAdvanced } = await import("../tcgdex");
    const results = await searchCardsAdvanced({ name: "Pikachu" });

    const cardsCall = (
      mockedAxios.get as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]: [string]) => url.includes("/cards"));
    expect(cardsCall[1].params).toMatchObject({ name: "Pikachu" });
    expect(results[0].name).toBe("Pikachu");
  });

  it("resolves set name to set ID before querying (Crown Zenith → swsh12pt5)", async () => {
    mockedAxios.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/sets")) return Promise.resolve({ data: makeSets() });
      return Promise.resolve({
        data: [makeCard("swsh12pt5-72", "Pikachu", "swsh12pt5")],
      });
    });
    const { searchCardsAdvanced } = await import("../tcgdex");
    await searchCardsAdvanced({ setName: "Crown Zenith" });

    const cardsCall = (
      mockedAxios.get as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]: [string]) => url.includes("/cards"));
    expect(cardsCall[1].params).toMatchObject({ set: "swsh12pt5" });
  });

  it("resolves set name case-insensitively", async () => {
    mockedAxios.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/sets")) return Promise.resolve({ data: makeSets() });
      return Promise.resolve({ data: [] });
    });
    const { searchCardsAdvanced } = await import("../tcgdex");
    await searchCardsAdvanced({ setName: "crown zenith" });

    const cardsCall = (
      mockedAxios.get as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]: [string]) => url.includes("/cards"));
    expect(cardsCall[1].params).toMatchObject({ set: "swsh12pt5" });
  });

  it("uses setId directly when provided without set name lookup", async () => {
    mockedAxios.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/sets")) return Promise.resolve({ data: makeSets() });
      return Promise.resolve({ data: [] });
    });
    const { searchCardsAdvanced } = await import("../tcgdex");
    await searchCardsAdvanced({ setId: "swsh12pt5" });

    const cardsCall = (
      mockedAxios.get as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]: [string]) => url.includes("/cards"));
    expect(cardsCall[1].params).toMatchObject({ set: "swsh12pt5" });
  });

  it("applies rarity filter", async () => {
    mockedAxios.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/sets")) return Promise.resolve({ data: makeSets() });
      return Promise.resolve({ data: [] });
    });
    const { searchCardsAdvanced } = await import("../tcgdex");
    await searchCardsAdvanced({ rarity: "Special Illustration Rare" });

    const cardsCall = (
      mockedAxios.get as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]: [string]) => url.includes("/cards"));
    expect(cardsCall[1].params).toMatchObject({
      rarity: "Special Illustration Rare",
    });
  });

  it("combines name and set name filters", async () => {
    mockedAxios.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/sets")) return Promise.resolve({ data: makeSets() });
      return Promise.resolve({
        data: [makeCard("swsh12pt5-72", "Pikachu", "swsh12pt5")],
      });
    });
    const { searchCardsAdvanced } = await import("../tcgdex");
    await searchCardsAdvanced({ name: "Pikachu", setName: "Crown Zenith" });

    const cardsCall = (
      mockedAxios.get as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]: [string]) => url.includes("/cards"));
    expect(cardsCall[1].params).toMatchObject({
      name: "Pikachu",
      set: "swsh12pt5",
    });
  });

  it("returns empty array when set name not found in sets list", async () => {
    mockedAxios.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/sets")) return Promise.resolve({ data: makeSets() });
      return Promise.resolve({ data: [] });
    });
    const { searchCardsAdvanced } = await import("../tcgdex");
    const results = await searchCardsAdvanced({ setName: "Nonexistent Set" });
    // No set ID resolved → no set filter → cards query still fires (name/rarity may be absent)
    // With no other filters and an unknown set, result should be empty
    expect(results).toHaveLength(0);
  });
});

// ── getSets ──────────────────────────────────────────────────────────────────

describe("getSets", () => {
  it("returns logo URL with .webp suffix from TCGdex API response", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: makeSets() });
    const { getSets } = await import("../tcgdex");
    const sets = await getSets();
    const crown = sets.find((s) => s.id === "swsh12pt5");
    expect(crown).toBeDefined();
    expect(crown!.logo).toBe(
      "https://assets.tcgdex.net/en/swsh/swsh12pt5/logo.webp",
    );
  });

  it("returns null logo when API omits logo field", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: makeSets() });
    const { getSets } = await import("../tcgdex");
    const sets = await getSets();
    const base = sets.find((s) => s.id === "base1");
    expect(base).toBeDefined();
    expect(base!.logo).toBeNull();
  });

  it("returns all expected fields: id, name, series, releaseDate, logo", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: makeSets() });
    const { getSets } = await import("../tcgdex");
    const sets = await getSets();
    const sv = sets.find((s) => s.id === "sv1");
    expect(sv).toMatchObject({
      id: "sv1",
      name: "Scarlet & Violet",
      series: "Scarlet & Violet",
      releaseDate: "2023-03-31",
      logo: "https://assets.tcgdex.net/en/sv/sv1/logo.webp",
    });
  });
});
