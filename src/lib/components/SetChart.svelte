<script lang="ts">
  import type { TrainingSet } from '#lib/types.ts';
  import { onMount } from 'svelte';
  let { sets, days }: { sets: TrainingSet[]; days: number } = $props();
  let width = $state(820);
  let chart = $state<SVGSVGElement>();
  const height = 210,
    left = 46,
    right = 12,
    top = 15,
    bottom = 30;
  // Half an hour of padding keeps the first and last bar inside the plot.
  let minTime = $derived(sets.length ? Date.parse(sets[0].endedAt) - 1_800_000 : 0);
  let maxTime = $derived(sets.length ? Date.parse(sets[sets.length - 1].endedAt) + 1_800_000 : 1);
  let maxValue = $derived(Math.max(5, ...sets.map((set) => set.reps)) * 1.1);
  let barWidth = $derived(
    Math.min(18, Math.max(3, (width - left - right) / Math.max(1, sets.length) / 1.6))
  );
  const x = (time: string) =>
    left + ((Date.parse(time) - minTime) / Math.max(1, maxTime - minTime)) * (width - left - right);
  const y = (value: number) => height - bottom - (value / maxValue) * (height - top - bottom);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  $effect(() => {
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) => {
      width = Math.max(280, Math.round(entry.contentRect.width));
    });
    observer.observe(chart);
    return () => observer.disconnect();
  });
  // Longer ranges need the date; one day only needs the time.
  const time = (value: string) =>
    hydrated
      ? new Date(value).toLocaleString(
          [],
          days > 1
            ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
            : { hour: '2-digit', minute: '2-digit' }
        )
      : new Date(value)
          .toISOString()
          .slice(days > 1 ? 5 : 11, 16)
          .replace('T', ' ') + ' UTC';
</script>

{#if sets.length}
  <svg
    bind:this={chart}
    class="history-chart"
    viewBox={`0 0 ${width} ${height}`}
    role="img"
    aria-labelledby="chart-title chart-description"
  >
    <title id="chart-title">Repetitions per set</title>
    <desc id="chart-description"
      >{sets.length} sets with {Math.min(...sets.map((set) => set.reps))} to {Math.max(
        ...sets.map((set) => set.reps)
      )} repetitions. Recent sets are listed in the table below.</desc
    >
    {#each [0, 0.25, 0.5, 0.75, 1] as fraction}
      <line
        x1={left}
        x2={width - right}
        y1={y(maxValue * fraction)}
        y2={y(maxValue * fraction)}
        stroke="#e6e9e2"
        stroke-dasharray="4 5"
      />
      <text x={left - 12} y={y(maxValue * fraction) + 4} text-anchor="end" class="chart-label"
        >{Math.round(maxValue * fraction)}</text
      >
    {/each}
    {#each sets as set (set.id)}
      <rect
        class="chart-bar"
        x={x(set.endedAt) - barWidth / 2}
        y={y(set.reps)}
        width={barWidth}
        height={height - bottom - y(set.reps)}
        rx="2"><title>{set.reps} reps · {time(set.endedAt)}</title></rect
      >
    {/each}
    <text x={left} y={height - 5} class="chart-label">{time(sets[0].endedAt)}</text>
    {#if sets.length > 1}<text
        x={width - right}
        y={height - 5}
        text-anchor="end"
        class="chart-label">{time(sets[sets.length - 1].endedAt)}</text
      >{/if}
  </svg>
{:else}
  <div class="empty-chart">
    <span aria-hidden="true">∿</span><strong>No finished sets in this range</strong>
    <p>Pick up the dumbbell. A set appears here after its last repetition.</p>
  </div>
{/if}
