<script lang="ts">
  import { tr, type MessageKey } from "../../lib/i18n.js";
  import { isFoundryBuildClaimable } from "../../lib/inventory/foundryResources.js";
  import { currentView } from "../../stores/app.js";
  import { foundryData } from "../../stores/data.js";
  import { masteryData } from "../../stores/mastery.js";
  import { masteryPins } from "../../stores/masteryPins.js";
  import WidgetFrame from "./WidgetFrame.svelte";

  interface AdvisorAction {
    id: string;
    title: MessageKey;
    detail: MessageKey;
    params?: Record<string, string | number>;
    view: "mastery" | "foundry";
  }

  interface Props {
    nowMs: number;
  }

  const { nowMs }: Props = $props();

  const rank = $derived($masteryData?.stats.profileMastery?.rank ?? null);
  const stageKey = $derived(
    rank == null
      ? "dashboard.advisor.stageUnknown"
      : rank < 6
        ? "dashboard.advisor.stageStart"
        : rank < 16
          ? "dashboard.advisor.stageGrow"
          : rank < 30
            ? "dashboard.advisor.stageAdvance"
            : "dashboard.advisor.stageVeteran",
  );

  const actions = $derived.by((): AdvisorAction[] => {
    const data = $masteryData;
    if (!data) return [];

    const result: AdvisorAction[] = [];
    if (data.stats.profileMastery?.testReady) {
      result.push({
        id: "rank-test",
        title: "dashboard.advisor.rankTestTitle",
        detail: "dashboard.advisor.rankTestDetail",
        view: "mastery",
      });
    }

    const claimable = $foundryData.building.filter((entry) =>
      isFoundryBuildClaimable(entry, nowMs),
    ).length;
    if (claimable > 0) {
      result.push({
        id: "claim-foundry",
        title: "dashboard.advisor.claimTitle",
        detail: "dashboard.advisor.claimDetail",
        params: { count: claimable },
        view: "foundry",
      });
    }

    if ($masteryPins.length > 0) {
      result.push({
        id: "pinned-goals",
        title: "dashboard.advisor.pinnedTitle",
        detail: "dashboard.advisor.pinnedDetail",
        params: { count: $masteryPins.length },
        view: "mastery",
      });
    }

    const completion = data.stats.completion;
    const normalChart = completion?.starChart.normal;
    if (normalChart && normalChart.total > normalChart.done) {
      result.push({
        id: "normal-chart",
        title: "dashboard.advisor.chartTitle",
        detail: "dashboard.advisor.chartDetail",
        params: { count: normalChart.total - normalChart.done },
        view: "mastery",
      });
    } else {
      const junctions = completion?.starChart.junctions;
      if (junctions && junctions.total > junctions.done) {
        result.push({
          id: "junctions",
          title: "dashboard.advisor.junctionTitle",
          detail: "dashboard.advisor.junctionDetail",
          params: { count: junctions.total - junctions.done },
          view: "mastery",
        });
      } else {
        const steelPath = completion?.starChart.steelPath;
        if (steelPath && steelPath.total > steelPath.done) {
          result.push({
            id: "steel-path",
            title: "dashboard.advisor.steelPathTitle",
            detail: "dashboard.advisor.steelPathDetail",
            params: { count: steelPath.total - steelPath.done },
            view: "mastery",
          });
        }
      }
    }

    if (result.length < 3) {
      const railjack = completion?.intrinsics.railjack;
      if (railjack && railjack.total > railjack.done) {
        result.push({
          id: "railjack-intrinsics",
          title: "dashboard.advisor.railjackTitle",
          detail: "dashboard.advisor.intrinsicsDetail",
          params: { count: railjack.total - railjack.done },
          view: "mastery",
        });
      }
    }

    if (result.length < 3) {
      const drifter = completion?.intrinsics.drifter;
      if (drifter && drifter.total > drifter.done) {
        result.push({
          id: "drifter-intrinsics",
          title: "dashboard.advisor.drifterTitle",
          detail: "dashboard.advisor.intrinsicsDetail",
          params: { count: drifter.total - drifter.done },
          view: "mastery",
        });
      }
    }

    if (result.length < 3 && data.stats.missing > 0) {
      result.push({
        id: "mastery-roadmap",
        title: "dashboard.advisor.masteryTitle",
        detail: "dashboard.advisor.masteryDetail",
        params: { count: data.stats.missing },
        view: "mastery",
      });
    }

    if (result.length === 0) {
      result.push({
        id: "mastery-next",
        title: "dashboard.advisor.nextTitle",
        detail: "dashboard.advisor.nextDetail",
        view: "mastery",
      });
    }
    return result.slice(0, 3);
  });
</script>

<WidgetFrame
  widgetId="widget.stageAdvisor"
  empty={!$masteryData}
  emptyKey="app.noInventoryLoaded"
>
  {#snippet subtitle()}
    <p class="m-0 text-[0.68rem] text-text-muted" data-widget-status>
      {#if rank !== null}
        {$tr("dashboard.advisor.rank", { rank })} ·
      {/if}
      {$tr(stageKey)}
      <span class="block">{$tr("dashboard.advisor.stageHint")}</span>
    </p>
  {/snippet}
  <ul class="m-0 flex flex-col gap-1.5 p-0">
    {#each actions as action (action.id)}
      <li>
        <button
          type="button"
          class="w-full rounded-[var(--radius-sm)] border border-transparent bg-bg-raised/50 px-2 py-1.5 text-left transition-colors hover:border-accent/40 hover:bg-bg-hover"
          onclick={() => currentView.set(action.view)}
        >
          <span class="block text-sm font-medium text-text-primary">{$tr(action.title)}</span>
          <span class="block text-xs text-text-muted">{$tr(action.detail, action.params)}</span>
        </button>
      </li>
    {/each}
  </ul>
</WidgetFrame>
