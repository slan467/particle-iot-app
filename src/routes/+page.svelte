<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { DashboardSnapshot, CollectorStatus } from '#lib/types.ts';
  import HistoryChart from '#lib/components/HistoryChart.svelte';

  const refreshIntervalMs = 10_000;

  let { data } = $props();
  let snapshot = $state<DashboardSnapshot | null>(untrack(() => data.snapshot));
  let status = $state<CollectorStatus | null>(untrack(() => data.snapshot?.status ?? null));
  let error = $state(untrack(() => data.initialError));
  let feedback = $state('');
  let busy = $state<'read' | 'reset' | null>(null);
  let variable = $state<number | null>(null);
  let readAt = $state<string | null>(null);
  let minutes = $state('60');
  let clearedAt = $state(0);
  let refreshing = $state(false);
  let hydrated = $state(false);
  let mounted = false;
  let abort: AbortController | undefined;
  let visibleReadings = $derived(
    (snapshot?.readings ?? []).filter((r) => Date.parse(r.publishedAt) > clearedAt)
  );
  let recent = $derived([...(snapshot?.readings ?? [])].reverse().slice(0, 6));
  const time = (value: string | null | undefined) =>
    value
      ? hydrated
        ? new Date(value).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        : new Date(value).toISOString().slice(11, 19) + ' UTC'
      : '—';

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    abort = new AbortController();
    const timeout = setTimeout(() => abort?.abort(), 12_000);
    try {
      const [readingsResponse, statusResponse] = await Promise.all([
        fetch(`/api/readings?minutes=${minutes}&limit=120`, { signal: abort.signal }),
        fetch('/api/status', { signal: abort.signal })
      ]);
      if (statusResponse.ok) status = await statusResponse.json();
      const result = await readingsResponse.json();
      if (!readingsResponse.ok) throw new Error(result.error ?? 'Readings unavailable.');
      snapshot = result;
      error = '';
    } catch (cause) {
      if (mounted)
        error =
          cause instanceof Error && cause.name !== 'AbortError'
            ? cause.message
            : 'Connection timed out. Retrying automatically.';
    } finally {
      clearTimeout(timeout);
      refreshing = false;
    }
  }

  async function command(action: 'read' | 'reset') {
    busy = action;
    feedback = '';
    try {
      const response = await fetch(
        action === 'read' ? '/api/device/variable' : '/api/device/reset',
        {
          method: action === 'read' ? 'GET' : 'POST',
          ...(action === 'reset'
            ? { headers: { 'Content-Type': 'application/json' }, body: '{}' }
            : {}),
          signal: AbortSignal.timeout(20_000)
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Device request failed.');
      if (action === 'read') {
        variable = result.value;
        readAt = result.readAt;
        feedback = 'Current variable read from the device.';
      } else {
        feedback = 'Reset confirmed by the device. Waiting for its event.';
        await refresh();
      }
    } catch (cause) {
      feedback = cause instanceof Error ? cause.message : 'Device request failed.';
    } finally {
      busy = null;
    }
  }

  onMount(() => {
    hydrated = true;
    mounted = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await refresh();
      if (mounted) timer = setTimeout(poll, refreshIntervalMs);
    };
    void poll();
    return () => {
      mounted = false;
      clearTimeout(timer);
      abort?.abort();
    };
  });
</script>

<svelte:head
  ><title>Overview · Fieldwork IoT</title><meta
    name="description"
    content="An IoT workspace for Particle Photon 2. Follow live readings, explore history and control your device."
  /></svelte:head
>

<header class="page-header">
  <div>
    <div class="eyebrow">YOUR CONNECTED PROJECT</div>
    <h1>Device overview<span class="heading-dot">.</span></h1>
    <p>A little signal from the physical world.</p>
  </div>
  <a class="text-link" href="/guide">Make it your own <span aria-hidden="true">↗</span></a>
</header>

<div class="device-strip">
  <div class="device-name">
    <span class="device-icon" aria-hidden="true">◈</span>
    <div>
      <strong>{snapshot?.deviceLabel ?? 'Particle device'}</strong><span>COUNTER PROJECT / 01</span>
    </div>
  </div>
  <div class="device-badges">
    <span class="badge neutral"
      >{status?.mode === 'mock' ? 'SIMULATED DEVICE' : 'PARTICLE CLOUD'}</span
    ><span class="badge" class:warning={status?.connection !== 'connected'}
      ><span class="status-dot"></span>{status?.connection === 'connected'
        ? 'Collector connected'
        : (status?.connection ?? 'Connecting')}</span
    >
  </div>
</div>

{#if status?.mode === 'mock'}<div class="mode-note">
    <span aria-hidden="true">✳</span>
    <p>
      <strong>You’re in mock mode.</strong> Explore the app with a simulated Photon 2. No cloud credentials
      needed.
    </p>
    <a href="/guide">Connect hardware →</a>
  </div>{/if}
{#if error}<div class="alert" role="alert">
    {error}
    {snapshot ? 'Showing the last available readings.' : ''}
  </div>{/if}
{#if status?.connectionError}<div class="alert" role="status">{status.connectionError}</div>{/if}
{#if status?.storageError}<div class="alert" role="status">{status.storageError}</div>{/if}

<section class="metric-grid" aria-label="Device measurements">
  <article class="metric-card featured">
    <div class="metric-label">LATEST EVENT <span aria-hidden="true">↗</span></div>
    <div class="metric-value">{snapshot?.latest?.counter ?? '—'}<span>count</span></div>
    <div class="metric-caption">
      {snapshot?.eventName ?? 'CounterEvent'} <span>· {time(snapshot?.latest?.publishedAt)}</span>
    </div>
  </article>
  <article class="metric-card">
    <div class="metric-label">DEVICE VARIABLE <span aria-hidden="true">⌁</span></div>
    <div class="metric-value">{variable ?? '—'}<span>count</span></div>
    <div class="metric-caption">
      {readAt ? `Read at ${time(readAt)}` : 'Read directly from your device'}
    </div>
  </article>
  <article class="metric-card">
    <div class="metric-label">STORED THIS SESSION <span aria-hidden="true">▤</span></div>
    <div class="metric-value">{status?.saved ?? 0}<span>events</span></div>
    <div class="metric-caption">
      {status?.storage === 'memory'
        ? 'In memory · resets on restart'
        : 'MongoDB · persisted readings'}
    </div>
  </article>
</section>

<div class="workspace-grid">
  <section class="panel history-panel">
    <div class="panel-heading">
      <div>
        <h2>Counter history</h2>
        <p>Your device, over time.</p>
      </div>
      <label class="select-label"
        ><span class="sr-only">History range</span><select
          bind:value={minutes}
          onchange={() => {
            clearedAt = 0;
            void refresh();
          }}
          ><option value="15">Last 15 minutes</option><option value="60">Last hour</option><option
            value="1440">Last 24 hours</option
          ></select
        ></label
      >
    </div>
    <div class="chart-key">
      <span class="legend-line"></span>{snapshot?.eventName ?? 'CounterEvent'}<span class="muted"
        >· newest {visibleReadings.length} readings</span
      >
    </div>
    <HistoryChart readings={visibleReadings} />
    <div class="panel-footer">
      <span><span class="tiny-dot"></span>Updates every {refreshIntervalMs / 1000} seconds</span
      ><button
        class="quiet-button"
        onclick={() => {
          clearedAt = Date.now();
        }}>Clear chart view</button
      >
    </div>
  </section>
  <section class="panel controls-panel">
    <div class="panel-heading">
      <div>
        <h2>Device controls</h2>
        <p>Send a small instruction.</p>
      </div>
      <span aria-hidden="true" class="control-symbol">⌘</span>
    </div>
    <div class="control-description">
      <span class="mini-label">READ A VARIABLE</span>
      <p>Ask the device for its current counter.</p>
      <button class="button secondary" disabled={busy !== null} onclick={() => command('read')}
        >{busy === 'read' ? 'Reading…' : 'Get counter value'}<span aria-hidden="true">↗</span
        ></button
      >
    </div>
    <div class="control-description">
      <span class="mini-label">CALL A FUNCTION</span>
      <p>Start counting from zero again.</p>
      <button class="button primary" disabled={busy !== null} onclick={() => command('reset')}
        >{busy === 'reset' ? 'Resetting…' : 'Reset counter to 0'}<span aria-hidden="true">↺</span
        ></button
      >
    </div>
    <p class="control-feedback" role="status">
      {feedback || 'Public demo controls · everyone can interact.'}
    </p>
  </section>
</div>

<section class="panel events-panel">
  <div class="panel-heading">
    <div>
      <h2>Recent events</h2>
      <p>Every reading has a story.</p>
    </div>
    <span class="badge neutral">{status?.storage === 'mongodb' ? 'MONGODB' : 'MEMORY STORE'}</span>
  </div>
  <div class="table-scroll">
    <table>
      <thead><tr><th>EVENT</th><th>VALUE</th><th>PUBLISHED</th><th>RECEIVED</th></tr></thead><tbody
        >{#each recent as reading (reading.id)}<tr
            ><td><span class="event-dot"></span>{reading.eventName}</td><td class="table-value"
              >{reading.counter}</td
            ><td>{time(reading.publishedAt)}</td><td>{time(reading.receivedAt)}</td></tr
          >{:else}<tr
            ><td colspan="4" class="muted">No recorded events yet. Check collector status below.</td
            ></tr
          >{/each}</tbody
      >
    </table>
  </div>
</section>

<footer class="page-footer">
  <span>Built to connect. Ready to grow.</span><span
    >Queue: {status?.pending ?? 0} · Rejected: {status?.rejected ?? 0} · Dropped: {status?.dropped ??
      0} · Last write: {time(status?.lastWriteAt)}</span
  >
</footer>
