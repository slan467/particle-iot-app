<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import '../app.css';
  let { children }: { children: Snippet } = $props();
</script>

<div class="app-shell">
  <aside class="sidebar">
    <a class="brand" href="/" aria-label="Fieldwork home">
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"
        ><path
          d="M3 19h7l4-12 5 20 4-14h6"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        /></svg
      >
      <span>fieldwork<span class="brand-dot">.</span></span>
    </a>
    <div class="sidebar-label">YOUR IOT WORKSPACE</div>
    <nav aria-label="Main navigation">
      <a
        href="/"
        class:active={page.url.pathname === '/'}
        aria-current={page.url.pathname === '/' ? 'page' : undefined}
      >
        <span aria-hidden="true">▦</span> Overview
      </a>
      <a
        href="/guide"
        class:active={page.url.pathname === '/guide'}
        aria-current={page.url.pathname === '/guide' ? 'page' : undefined}
      >
        <span aria-hidden="true">⌘</span> Project guide
      </a>
    </nav>
    <div class="sidebar-bottom">
      <h2>Small device.<br />Big possibilities.</h2>
      <p>Your starting point for something connected.</p>
      <div class="sidebar-footer">PARTICLE × SVELTEKIT</div>
    </div>
  </aside>
  <main id="main-content">{@render children()}</main>
</div>
