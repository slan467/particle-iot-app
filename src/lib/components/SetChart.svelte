<script lang="ts">
  import type { Reading } from '#lib/types.ts';
  import { onMount } from 'svelte';
  let { readings }: { readings: Reading[] } = $props();
  let width = $state(820);
  let chart = $state<SVGSVGElement>();
  const height = 210,
    left = 46,
    right = 12,
    top = 15,
    bottom = 30;
  let minTime = $derived(readings.length ? Date.parse(readings[0].publishedAt) : 0);
  let maxTime = $derived(
    readings.length ? Date.parse(readings[readings.length - 1].publishedAt) : 1
  );
  let maxValue = $derived(Math.max(5, ...readings.map((r) => r.counter)) * 1.1);
  const x = (time: string) =>
    left + ((Date.parse(time) - minTime) / Math.max(1, maxTime - minTime)) * (width - left - right);
  const y = (value: number) => height - bottom - (value / maxValue) * (height - top - bottom);
  let points = $derived(readings.map((r) => `${x(r.publishedAt)},${y(r.counter)}`).join(' '));
  let area = $derived(
    readings.length
      ? `${x(readings[0].publishedAt)},${height - bottom} ${points} ${x(readings[readings.length - 1].publishedAt)},${height - bottom}`
      : ''
  );
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
  const time = (value: string) =>
    hydrated
      ? new Date(value).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      : new Date(value).toISOString().slice(11, 19) + ' UTC';
</script>

{#if readings.length}
  <svg
    bind:this={chart}
    class="history-chart"
    viewBox={`0 0 ${width} ${height}`}
    role="img"
    aria-labelledby="chart-title chart-description"
  >
    <title id="chart-title">Counter history</title>
    <desc id="chart-description"
      >{readings.length} readings, from {readings[0].counter} to {readings[readings.length - 1]
        .counter}. Recent values are listed in the event table below.</desc
    >
    <defs
      ><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"
        ><stop offset="0%" stop-color="#80b78e" stop-opacity="0.25" /><stop
          offset="100%"
          stop-color="#80b78e"
          stop-opacity="0.02"
        /></linearGradient
      ></defs
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
    <polygon points={area} fill="url(#chart-fill)" />
    <polyline {points} fill="none" stroke="#34715a" stroke-width="2.5" stroke-linejoin="round" />
    {#if readings.length === 1}<circle
        cx={x(readings[0].publishedAt)}
        cy={y(readings[0].counter)}
        r="4"
        fill="#34715a"
      />{/if}
    <circle
      cx={x(readings[readings.length - 1].publishedAt)}
      cy={y(readings[readings.length - 1].counter)}
      r="4"
      fill="#34715a"
      stroke="white"
      stroke-width="2"
    />
    <text x={left} y={height - 5} class="chart-label">{time(readings[0].publishedAt)}</text>
    {#if readings.length > 1}<text
        x={width - right}
        y={height - 5}
        text-anchor="end"
        class="chart-label">{time(readings[readings.length - 1].publishedAt)}</text
      >{/if}
  </svg>
{:else}
  <div class="empty-chart">
    <span aria-hidden="true">∿</span><strong>Waiting for the next reading</strong>
    <p>New events will appear here automatically.</p>
  </div>
{/if}
