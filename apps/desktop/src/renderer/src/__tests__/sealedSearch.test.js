/**
 * TDD tests for sealed product search detection and query normalization.
 *
 * Requirements:
 *  - "etb", "Etb", "ETB" → detected as sealed query
 *  - "elite trainer box" variants → detected as sealed query
 *  - "crown zenith etb" → detected as sealed, normalized to full phrase
 *  - Plain card names ("pikachu", "charizard") → NOT detected as sealed
 *  - normalizeForSealedSearch expands abbreviations before sending to backend
 */

import {
  isSealedProductQuery,
  normalizeForSealedSearch,
  parseSealedProducts,
} from "../utils/sealedSearch";

// ── isSealedProductQuery ─────────────────────────────────────────────────────

describe("isSealedProductQuery", () => {
  // ETB variants
  it('detects bare "etb"', () =>
    expect(isSealedProductQuery("etb")).toBe(true));
  it('detects "Etb" (mixed case)', () =>
    expect(isSealedProductQuery("Etb")).toBe(true));
  it('detects "ETB" (uppercase)', () =>
    expect(isSealedProductQuery("ETB")).toBe(true));
  it('detects "crown zenith etb"', () =>
    expect(isSealedProductQuery("crown zenith etb")).toBe(true));
  it('detects "Elite Trainer Box"', () =>
    expect(isSealedProductQuery("Elite Trainer Box")).toBe(true));
  it('detects "elite trainer box" (lowercase)', () =>
    expect(isSealedProductQuery("elite trainer box")).toBe(true));
  it('detects "crown zenith elite trainer box"', () =>
    expect(isSealedProductQuery("crown zenith elite trainer box")).toBe(true));

  // Other sealed types
  it('detects "Booster Box"', () =>
    expect(isSealedProductQuery("Booster Box")).toBe(true));
  it('detects "booster box"', () =>
    expect(isSealedProductQuery("booster box")).toBe(true));
  it('detects "Booster Bundle"', () =>
    expect(isSealedProductQuery("Booster Bundle")).toBe(true));
  it('detects "Booster Pack"', () =>
    expect(isSealedProductQuery("Booster Pack")).toBe(true));
  it('detects "Collection Box"', () =>
    expect(isSealedProductQuery("Collection Box")).toBe(true));
  it('detects "Premium Collection"', () =>
    expect(isSealedProductQuery("Premium Collection")).toBe(true));

  // Should NOT detect regular card searches
  it('does not detect plain card name "pikachu"', () =>
    expect(isSealedProductQuery("pikachu")).toBe(false));
  it('does not detect "charizard"', () =>
    expect(isSealedProductQuery("charizard")).toBe(false));
  it('does not detect "crown zenith"', () =>
    expect(isSealedProductQuery("crown zenith")).toBe(false));
  it("does not detect empty string", () =>
    expect(isSealedProductQuery("")).toBe(false));
});

// ── normalizeForSealedSearch ──────────────────────────────────────────────────

describe("normalizeForSealedSearch", () => {
  it('expands "etb" → "elite trainer box"', () =>
    expect(normalizeForSealedSearch("etb")).toBe("elite trainer box"));

  it('expands "ETB" → "elite trainer box"', () =>
    expect(normalizeForSealedSearch("ETB")).toBe("elite trainer box"));

  it('expands "crown zenith etb" → "crown zenith elite trainer box"', () =>
    expect(normalizeForSealedSearch("crown zenith etb")).toBe(
      "crown zenith elite trainer box",
    ));

  it('expands " ETB " with surrounding spaces', () =>
    expect(normalizeForSealedSearch(" ETB ")).toBe("elite trainer box"));

  it('leaves "elite trainer box" unchanged', () =>
    expect(normalizeForSealedSearch("elite trainer box")).toBe(
      "elite trainer box",
    ));

  it('leaves "booster box" unchanged', () =>
    expect(normalizeForSealedSearch("booster box")).toBe("booster box"));

  it("returns lowercase", () =>
    expect(normalizeForSealedSearch("Crown Zenith Booster Box")).toBe(
      "crown zenith booster box",
    ));

  it("trims whitespace", () =>
    expect(normalizeForSealedSearch("  crown zenith etb  ")).toBe(
      "crown zenith elite trainer box",
    ));
});

// ── parseSealedProducts ───────────────────────────────────────────────────────

describe("parseSealedProducts", () => {
  it("extracts products array from { products: [...] } response", () => {
    const response = {
      products: [
        {
          id: "123",
          name: "Crown Zenith Elite Trainer Box",
          setName: "Pokemon",
        },
      ],
    };
    expect(parseSealedProducts(response)).toHaveLength(1);
    expect(parseSealedProducts(response)[0].name).toBe(
      "Crown Zenith Elite Trainer Box",
    );
  });

  it("returns empty array for null response", () =>
    expect(parseSealedProducts(null)).toEqual([]));

  it("returns empty array when products is missing", () =>
    expect(parseSealedProducts({})).toEqual([]));

  it("returns empty array when products is null", () =>
    expect(parseSealedProducts({ products: null })).toEqual([]));

  it("returns empty array for array response (old stub format)", () =>
    expect(parseSealedProducts([])).toEqual([]));
});
