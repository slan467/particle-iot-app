<svelte:head
  ><title>Project guide · Fieldwork IoT</title><meta
    name="description"
    content="Connect your Photon 2 and turn the IoT starter into your own project."
  /></svelte:head
>
<header class="page-header">
  <div>
    <div class="eyebrow">FROM IDEA TO SOMETHING CONNECTED</div>
    <h1>Make it your own<span class="heading-dot">.</span></h1>
    <p>Start with a counter. Build something that matters to you.</p>
  </div>
</header>
<div class="guide-grid">
  <section class="panel guide-card">
    <span class="step-number">01 / EXPLORE</span>
    <h2>Follow one reading</h2>
    <p>
      The simulated device publishes an event approximately every ten seconds. The server validates
      and stores it. The dashboard asks for recent readings every ten seconds.
    </p>
    <div class="flow-summary">Device → Particle → Collector → Store → Dashboard</div>
    <a href="/" class="text-link">Explore the dashboard →</a>
  </section>
  <section class="panel guide-card">
    <span class="step-number">02 / CONNECT</span>
    <h2>Bring your Photon 2</h2>
    <p>
      Follow <code>docs/particle-setup.md</code> to flash the example firmware, create a two-legged
      OAuth client and configure MongoDB Atlas. Set <code>APP_MODE=live</code> in your local environment,
      then restart.
    </p>
    <p>
      Keep credentials in <code>.env</code> locally and in Render’s environment settings when deployed.
    </p>
  </section>
  <section class="panel guide-card">
    <span class="step-number">03 / BUILD</span>
    <h2>Give your agent a clear task</h2>
    <p>
      Use the shared <code>add-iot-feature</code> skill in Copilot, Codex or Claude Code. Describe the
      measurement, its unit, expected range and what a button should do.
    </p>
    <blockquote>
      “Trace CounterEvent from the Photon 2 firmware through validation and storage to the
      dashboard. Explain how reading the counter variable and resetting it differ from event
      collection.”
    </blockquote>
  </section>
  <section class="panel guide-card">
    <span class="step-number">04 / SHARE</span>
    <h2>Take it into the world</h2>
    <p>
      Deploy one server per team using <code>render.yaml</code>. Free instances sleep after 15
      minutes without incoming requests; events during sleep are not recorded. Paid compute can
      collect without an open dashboard.
    </p>
    <p>
      Public controls are available to everyone. For pumps and other actuators, enforce safe
      operating limits in the firmware.
    </p>
  </section>
</div>
<section class="panel guide-card guide-resources">
  <h2>Your project map</h2>
  <p>
    The repository’s <code>README.md</code> is the starting point. The <code>docs/</code> folder
    explains architecture, data flow, configuration, deployment and troubleshooting. Begin with
    <code>docs/project-guide.md</code> for a guided change.
  </p>
</section>
