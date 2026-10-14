import { isActiveOrderStatus } from "../../../config/shared/wfmOrders.js";
import { computeRivenStatSimilarity } from "../../../renderer/riven-similarity.js";
import type { WfmRivenListing } from "../../types/ipc.js";

export type RivenValuationConfidence = "high" | "medium" | "low";

export interface RivenValuation {
  /** Weighted median asking price of comparable listings. */
  estimate: number;
  /** Weighted 25th / 75th percentile. */
  low: number;
  high: number;
  confidence: RivenValuationConfidence;
  /** Listings that contributed to the estimate. */
  sampleCount: number;
}

/** Below this similarity a listing is a different riven, not a comparable. */
const MIN_SIMILARITY_PCT = 50;
const FALLBACK_SIMILARITY_PCT = 25;
const MIN_COMPARABLES = 3;

function askingPrice(listing: WfmRivenListing): number | null {
  const price = listing.isDirectSell === false ? listing.buyoutPrice : listing.platinum;
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
}

function weightedQuantile(sorted: { price: number; weight: number }[], q: number): number {
  const total = sorted.reduce((sum, entry) => sum + entry.weight, 0);
  const target = total * q;
  let acc = 0;
  for (const entry of sorted) {
    acc += entry.weight;
    if (acc >= target) return entry.price;
  }
  return sorted[sorted.length - 1].price;
}

/**
 * Prices a riven from live warframe.market asking prices. Listings are weighted by
 * how many stats they share with the riven; auctions without a buyout are ignored
 * because a starting bid is not a price anyone has agreed to pay.
 */
export function estimateRivenValue(
  myStatNames: readonly string[],
  listings: readonly WfmRivenListing[],
): RivenValuation | null {
  const names = myStatNames.map((name) => name.toLowerCase());
  const scored: { price: number; pct: number }[] = [];
  for (const listing of listings) {
    if (!isActiveOrderStatus(listing.sellerStatus)) continue;
    const price = askingPrice(listing);
    if (price === null) continue;
    scored.push({ price, pct: computeRivenStatSimilarity(names, listing.stats).pct });
  }

  let pool = scored.filter((entry) => entry.pct >= MIN_SIMILARITY_PCT);
  let relaxed = false;
  if (pool.length < MIN_COMPARABLES) {
    pool = scored.filter((entry) => entry.pct >= FALLBACK_SIMILARITY_PCT);
    relaxed = true;
  }
  if (pool.length === 0) return null;

  const weighted = pool
    .map((entry) => ({ price: entry.price, weight: (entry.pct / 100) ** 2 }))
    .sort((a, b) => a.price - b.price);
  const close = pool.filter((entry) => entry.pct >= 75).length;

  let confidence: RivenValuationConfidence = "low";
  if (!relaxed && close >= 5) confidence = "high";
  else if (!relaxed && pool.length >= MIN_COMPARABLES) confidence = "medium";

  return {
    estimate: Math.round(weightedQuantile(weighted, 0.5)),
    low: Math.round(weightedQuantile(weighted, 0.25)),
    high: Math.round(weightedQuantile(weighted, 0.75)),
    confidence,
    sampleCount: pool.length,
  };
}
