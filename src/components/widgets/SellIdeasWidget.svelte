<script lang="ts">
  import { tr } from "../../lib/i18n.js";
  import {
    buildBaseInventoryItems,
    buildInventoryViewItems,
    buildOrderLookups,
    type InventoryBaseItem,
  } from "../../lib/inventoryMarket.js";
  import { inventorySafetyVerdicts, verdictFor } from "../../stores/inventorySafety.js";
  import { dashboardLayout, settingNumber, widgetSettings } from "../../stores/dashboard.js";
  import { getInventoryHydrationController } from "../../stores/inventoryHydration.js";
  import { marketOrders, marketSession, marketViewState } from "../../stores/market.js";
  import { parsedItems, wfmItems } from "../../stores/data.js";
  import { currentView } from "../../stores/app.js";
  import { relicDb } from "../../stores/relics.js";
  import { toFiniteNumber } from "../../../config/shared/numeric.js";
  import { isWfmExcludedSlug } from "../../../config/shared/wfmExclusions.js";
  import WidgetFrame from "./WidgetFrame.svelte";

  interface Props {
    nowMs: number;
  }

  const { nowMs }: Props = $props();

  interface SellIdea {
    key: string;
    name: string;
    orderPlaced: boolean;
    priceRank: number | null;
    quantity: number;
    unitPrice: number;
    estimatedValue: number;
  }

  interface SellIdeaSummary {
    ideas: SellIdea[];
    safeStock: number;
    unpriced: number;
  }

  const settings = $derived(widgetSettings($dashboardLayout, "widget.sellIdeas"));
  const limit = $derived(settingNumber(settings, "limit", 5));
  const ordersVerified = $derived(
    $marketSession.loggedIn &&
      $marketViewState.ordersLastFetch > 0 &&
      nowMs - $marketViewState.ordersLastFetch < 30_000,
  );
  // This widget reads the shared cache. The Inventory view owns network loading,
  // so opening the dashboard never starts a surprise market crawl.
  const hydrationMetrics = getInventoryHydrationController().metricsByKey;

  const baseRows = $derived.by((): InventoryBaseItem[] => {
    const lookups = buildOrderLookups({ sell: $marketOrders.sell, buy: [] });
    return buildBaseInventoryItems(
      $parsedItems,
      "everything",
      $wfmItems,
      lookups.orderedNames,
      lookups.orderedSlugs,
      $relicDb,
      lookups.orderedSubtypes,
    ).filter(
      (item) =>
        item.tradable === true &&
        item.inventoryGroup !== "full_sets" &&
        item.inventoryGroup !== "incomplete_sets" &&
        item.inventoryGroup !== "equipment",
    );
  });

  const summary = $derived.by((): SellIdeaSummary => {
    const ideas: SellIdea[] = [];
    let safeStock = 0;
    let unpriced = 0;
    const pricedRows = buildInventoryViewItems(baseRows, $hydrationMetrics);

    for (const item of pricedRows) {
      if (
        !item.marketSlug ||
        isWfmExcludedSlug(item.marketSlug) ||
        (ordersVerified && item.orderPlaced)
      )
        continue;
      const verdict = verdictFor(item, $inventorySafetyVerdicts);
      if (!verdict || verdict.safe <= 0) continue;
      const quantity = Math.min(Math.floor(item.amount), Math.floor(verdict.safe));
      if (quantity <= 0) continue;
      safeStock += 1;

      const unitPrice = toFiniteNumber(item.platinum);
      if (unitPrice == null || unitPrice <= 0) {
        unpriced += 1;
        continue;
      }

      ideas.push({
        key: `${item.internalName}:${item.rank}:${item.subtype ?? ""}`,
        name: item.displayName || item.name,
        orderPlaced: item.orderPlaced,
        priceRank:
          item.inventoryGroup === "mods" || item.inventoryGroup === "arcanes"
            ? item.rank >= item.maxRank
              ? item.maxRank
              : 0
            : null,
        quantity,
        unitPrice,
        estimatedValue: Math.floor(unitPrice * quantity),
      });
    }

    ideas.sort(
      (a, b) =>
        Number(a.orderPlaced) - Number(b.orderPlaced) ||
        b.estimatedValue - a.estimatedValue ||
        b.unitPrice - a.unitPrice ||
        b.quantity - a.quantity ||
        a.name.localeCompare(b.name),
    );
    return { ideas, safeStock, unpriced };
  });

  const shown = $derived(summary.ideas.slice(0, limit));
  const emptyKey = $derived(
    $parsedItems.length === 0
      ? "app.noInventoryLoaded"
      : summary.safeStock === 0
        ? "dashboard.sellIdeas.noSafeStock"
        : "dashboard.sellIdeas.noPrices",
  );
</script>

<WidgetFrame
  widgetId="widget.sellIdeas"
  empty={shown.length === 0}
  emptyKey={emptyKey}
  overflow={summary.ideas.length - shown.length}
>
  {#snippet subtitle()}
    <p class="m-0 text-[0.68rem] text-text-muted" data-widget-status>
      {$tr("dashboard.sellIdeas.subtitle", { count: String(summary.safeStock) })}
      {#if ordersVerified}
        <span class="block">{$tr("dashboard.sellIdeas.ordersVerified")}</span>
      {:else}
        <span class="block">{$tr("dashboard.sellIdeas.checkOrders")}</span>
      {/if}
    </p>
  {/snippet}
  <ul class="m-0 max-h-[340px] flex-1 list-none overflow-y-auto p-0">
    {#each shown as idea (idea.key)}
      <li class="flex items-baseline gap-2 py-1 text-sm">
        <span class="min-w-0 flex-1 truncate text-text-secondary">
          {idea.name}
        </span>
        {#if idea.orderPlaced}
          <span class="shrink-0 text-[0.68rem] text-text-muted">
            {$tr("dashboard.sellIdeas.listed")}
          </span>
        {/if}
        <span class="shrink-0 text-[0.68rem] text-text-muted">
          {#if idea.priceRank !== null}R{idea.priceRank} · {/if}
          {idea.quantity} × {idea.unitPrice.toLocaleString()}p
        </span>
        <span class="shrink-0 font-display tabular-nums text-text-primary">
          ~{idea.estimatedValue.toLocaleString()}p
        </span>
      </li>
    {/each}
  </ul>
  <p class="m-0 text-[0.68rem] text-text-muted">
    {$tr("dashboard.sellIdeas.estimate")}
    {#if summary.unpriced > 0}
      &middot; {$tr("dashboard.sellIdeas.unpriced", { count: String(summary.unpriced) })}
    {/if}
  </p>
  <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2">
    <p class="m-0 flex-1 text-[0.68rem] text-text-muted">
      {$tr("dashboard.sellIdeas.rivenNote")}
    </p>
    <button
      type="button"
      class="shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-border px-2 py-1 text-xs text-text-secondary transition-colors duration-200 hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      onclick={() => currentView.set("rivens")}
    >
      {$tr("dashboard.sellIdeas.rivenLink")}
    </button>
  </div>
</WidgetFrame>
