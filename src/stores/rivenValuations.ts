import { writable } from "svelte/store";
import { invoke } from "../lib/ipc.js";
import { estimateRivenValue, type RivenValuation } from "../lib/rivens/valuation.js";
import type { DecodedRiven } from "../types/ipc.js";

/** itemId -> valuation; null means the market had no comparable listing. */
export const rivenValuations = writable<Map<string, RivenValuation | null>>(new Map());

export async function valueRiven(riven: DecodedRiven): Promise<RivenValuation | null> {
  const listings = await invoke("searchRivenAuctions", riven.weaponName, [], []);
  const valuation = estimateRivenValue(
    riven.stats.map((stat) => stat.name),
    listings,
  );
  rivenValuations.update((map) => new Map(map).set(riven.itemId, valuation));
  return valuation;
}
