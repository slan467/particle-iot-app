<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { DashboardSnapshot, CollectorStatus, DeviceState } from '#lib/types.ts';
  import { buildSets, liveSince, setsToday, summarize } from '#lib/training.ts';
  import SetChart from '#lib/components/SetChart.svelte';

  const refreshIntervalMs = 10_000;
  // The server caches device reads, so open tabs share requests and the command budget.
  const liveReadMs = 5_000;
  const restReadMs = 30_000;

  let { data } = $props();
  let snapshot = $state<DashboardSnapshot | null>(untrack(() => data.snapshot));
  let status = $state<CollectorStatus | null>(untrack(() => data.snapshot?.status ?? null));
  let error = $state(untrack(() => data.initialError));
  let feedback = $state('');
  let busy = $state<'read' | 'reset' | null>(null);
  let device = $state<DeviceState | null>(null);
  let days = $state('7');
  let refreshing = $state(false);
  let hydrated = $state(false);
  let now = $state(0);
  let mounted = false;
  let abort: AbortController | undefined;

  let sets = $derived(buildSets(snapshot?.events ?? []));
  let range = $derived(summarize(sets));
  // "Today" uses the viewer's timezone, so it is only computed in the browser.
  let today = $derived(hydrated ? summarize(setsToday(sets, new Date(now))) : null);
  let liveAt = $derived(hydrated ? liveSince(snapshot?.latest ?? null, now) : null);
  let live = $derived(liveAt !== null || (device?.repetitions ?? 0) > 0);
  let recent = $derived([...sets].reverse().slice(0, 8));
  let total = $derived(device?.totalCount ?? snapshot?.latest?.total ?? null);

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
  const date = (value: string) =>
    hydrated
      ? new Date(value).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
      : new Date(value).toISOString().slice(0, 10);
  const duration = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    abort = new AbortController();
    const timeout = setTimeout(() => abort?.abort(), 12_000);
    try {
      const [trainingsResponse, statusResponse] = await Promise.all([
        fetch(`/api/trainings?days=${days}&limit=500`, { signal: abort.signal }),
        fetch('/api/status', { signal: abort.signal })
      ]);
      if (statusResponse.ok) status = await statusResponse.json();
      const result = await trainingsResponse.json();
      if (!trainingsResponse.ok) throw new Error(result.error ?? 'Training history unavailable.');
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
      now = Date.now();
    }
  }

  /** `manual` reads report their outcome; automatic reads fail quietly. */
  async function readDevice(manual: boolean) {
    if (manual) {
      busy = 'read';
      feedback = '';
    }
    try {
      const response = await fetch('/api/device/state', { signal: AbortSignal.timeout(20_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Device request failed.');
      device = result;
      if (manual) feedback = 'Current state read from the device.';
    } catch (cause) {
      if (manual) feedback = cause instanceof Error ? cause.message : 'Device request failed.';
    } finally {
      if (manual) busy = null;
    }
  }

  async function resetTotal() {
    if (!confirm('Reset the total repetition count on the device to 0? Stored sets are kept.'))
      return;
    busy = 'reset';
    feedback = '';
    try {
      const response = await fetch('/api/device/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(20_000)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Device request failed.');
      feedback = 'Reset confirmed by the device. The total starts again at 0.';
      await readDevice(false);
    } catch (cause) {
      feedback = cause instanceof Error ? cause.message : 'Device request failed.';
    } finally {
      busy = null;
    }
  }

  onMount(() => {
    hydrated = true;
    mounted = true;
    now = Date.now();
    let historyTimer: ReturnType<typeof setTimeout>;
    let deviceTimer: ReturnType<typeof setTimeout>;
    const pollHistory = async () => {
      await refresh();
      if (mounted) historyTimer = setTimeout(pollHistory, refreshIntervalMs);
    };
    // Read faster while a set is running, so the live counter moves.
    const pollDevice = async () => {
      await readDevice(false);
      if (mounted) deviceTimer = setTimeout(pollDevice, live ? liveReadMs : restReadMs);
    };
    void pollHistory();
    void pollDevice();
    return () => {
      mounted = false;
      clearTimeout(historyTimer);
      clearTimeout(deviceTimer);
      abort?.abort();
    };
  });
</script>

<svelte:head
  ><title>Training · Fieldwork IoT</title><meta
    name="description"
    content="An IoT dumbbell on a Particle Photon 2. Follow your current set, your training history and your totals."
  /></svelte:head
>

<header class="page-header">
  <div>
    <div class="eyebrow">YOUR CONNECTED DUMBBELL</div>
    <h1>Training overview<span class="heading-dot">.</span></h1>
    <p>Every repetition, counted.</p>
  </div>
  <a class="text-link" href="/guide">How it works <span aria-hidden="true">↗</span></a>
</header>

<div class="device-strip">
  <div class="device-name">
    <span class="device-icon" aria-hidden="true">◈</span>
    <div>
      <strong>{snapshot?.deviceLabel ?? 'Particle device'}</strong><span>DUMBBELL PROJECT / 01</span
      >
    </div>
  </div>
  <div class="device-badges">
    <span class="badge neutral"
      >{status?.mode === 'mock' ? 'SIMULATED DEVICE' : 'PARTICLE CLOUD'}</span
    ><span class="badge" class:warning={device ? !device.sensorOk : false} class:neutral={!device}
      ><span class="status-dot"></span>{device
        ? device.sensorOk
          ? 'Sensor OK'
          : 'Sensor fault'
        : 'Sensor unknown'}</span
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
      <strong>You’re in mock mode.</strong> A simulated dumbbell trains a set every 20–40 seconds. No
      cloud credentials needed.
    </p>
    <a href="/guide">Connect hardware →</a>
  </div>{/if}
{#if error}<div class="alert" role="alert">
    {error}
    {snapshot ? 'Showing the last available sets.' : ''}
  </div>{/if}
{#if status?.connectionError}<div class="alert" role="status">{status.connectionError}</div>{/if}
{#if status?.storageError}<div class="alert" role="status">{status.storageError}</div>{/if}
{#if device && !device.sensorOk}<div class="alert" role="status">
    The device reports a sensor fault. Check the LIS3DH wiring (SDA=D0, SCL=D1, 3V3, GND).
  </div>{/if}

<section class="metric-grid" aria-label="Training measurements">
  <article class="metric-card featured" class:live>
    <div class="metric-label">
      {live ? 'SET IN PROGRESS' : 'CURRENT SET'} <span aria-hidden="true">{live ? '●' : '↗'}</span>
    </div>
    <div class="metric-value">{device?.repetitions ?? '—'}<span>reps</span></div>
    <div class="metric-caption">
      {#if live}
        Training since {time(liveAt ?? device?.readAt)}
      {:else}
        Resting <span>· last set {time(sets.at(-1)?.endedAt)}</span>
      {/if}
    </div>
  </article>
  <article class="metric-card">
    <div class="metric-label">TOTAL REPS <span aria-hidden="true">Σ</span></div>
    <div class="metric-value">{total ?? '—'}<span>reps</span></div>
    <div class="metric-caption">
      {device ? `Read at ${time(device.readAt)}` : 'From the latest event'}
      <span>· stored on the device</span>
    </div>
  </article>
  <article class="metric-card">
    <div class="metric-label">TODAY <span aria-hidden="true">◷</span></div>
    <div class="metric-value">{today?.reps ?? '—'}<span>reps</span></div>
    <div class="metric-caption">
      {today ? `${today.sets} ${today.sets === 1 ? 'set' : 'sets'}` : '—'}
      <span>· best set {today?.best ? `${today.best.reps} reps` : '—'}</span>
    </div>
  </article>
</section>

<div class="workspace-grid">
  <section class="panel history-panel">
    <div class="panel-heading">
      <div>
        <h2>Repetitions per set</h2>
        <p>Every bar is one finished set.</p>
      </div>
      <label class="select-label"
        ><span class="sr-only">History range</span><select
          bind:value={days}
          onchange={() => void refresh()}
          ><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option
            value="30">Last 30 days</option
          ></select
        ></label
      >
    </div>
    <div class="chart-key">
      <span class="legend-bar"></span>{snapshot?.eventName ?? 'training'}<span class="muted"
        >· {range.sets} sets · {range.reps} reps{range.averagePaceS !== null
          ? ` · ${range.averagePaceS} s per rep`
          : ''}</span
      >
    </div>
    <SetChart {sets} days={Number(days)} />
    <div class="panel-footer">
      <span><span class="tiny-dot"></span>Updates every {refreshIntervalMs / 1000} seconds</span>
      <span>{live ? 'Live set read every 5 seconds' : 'Device read every 30 seconds'}</span>
    </div>
  </section>
  <section class="panel controls-panel">
    <div class="panel-heading">
      <div>
        <h2>Device controls</h2>
        <p>Talk to the dumbbell.</p>
      </div>
      <span aria-hidden="true" class="control-symbol">⌘</span>
    </div>
    <div class="control-description">
      <span class="mini-label">READ VARIABLES</span>
      <p>Ask for the current set, the total and the sensor status.</p>
      <button class="button secondary" disabled={busy !== null} onclick={() => readDevice(true)}
        >{busy === 'read' ? 'Reading…' : 'Read device now'}<span aria-hidden="true">↗</span></button
      >
    </div>
    <div class="control-description">
      <span class="mini-label">CALL A FUNCTION</span>
      <p>Set the total back to zero. Stored sets stay in the history.</p>
      <button class="button primary" disabled={busy !== null} onclick={resetTotal}
        >{busy === 'reset' ? 'Resetting…' : 'Reset total count'}<span aria-hidden="true">↺</span
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
      <h2>Recent sets</h2>
      <p>Your latest training, set by set.</p>
    </div>
    <span class="badge neutral">{status?.storage === 'mongodb' ? 'MONGODB' : 'MEMORY STORE'}</span>
  </div>
  <div class="table-scroll">
    <table>
      <thead><tr><th>DATE</th><th>START</th><th>DURATION</th><th>REPS</th><th>PACE</th></tr></thead
      ><tbody
        >{#each recent as set (set.id)}<tr
            ><td><span class="event-dot"></span>{date(set.startedAt)}</td><td
              >{time(set.startedAt)}</td
            ><td>{duration(set.durationS)}</td><td class="table-value">{set.reps}</td><td
              >{set.paceS === null ? '—' : `${set.paceS} s/rep`}</td
            ></tr
          >{:else}<tr
            ><td colspan="5" class="muted">No finished sets yet. Check collector status below.</td
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
