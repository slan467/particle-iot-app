<svelte:head
  ><title>Project guide · Fieldwork IoT</title><meta
    name="description"
    content="How the IoT dumbbell counts repetitions and how to connect your own Photon 2."
  /></svelte:head
>
<header class="page-header">
  <div>
    <div class="eyebrow">FROM MOVEMENT TO DATA</div>
    <h1>How it works<span class="heading-dot">.</span></h1>
    <p>A sensor, a few thresholds and a dashboard that remembers every set.</p>
  </div>
</header>
<div class="guide-grid">
  <section class="panel guide-card">
    <span class="step-number">01 / COUNT</span>
    <h2>One lift, one repetition</h2>
    <p>
      The LIS3DH sensor measures acceleration 20 times per second. A repetition is counted when the
      smoothed Y axis moves from below 0.5 m/s² to above 2 m/s². After three regular repetitions the
      firmware publishes a <code>start</code> event; five seconds without a repetition end the set
      with an <code>end</code> event.
    </p>
    <div class="flow-summary">Dumbbell → Particle → Collector → Store → Dashboard</div>
    <a href="/" class="text-link">Explore the dashboard →</a>
  </section>
  <section class="panel guide-card">
    <span class="step-number">02 / SIMULATE</span>
    <h2>Test without the sensor first</h2>
    <p>
      Mock mode simulates the dumbbell inside the server. To test the cloud path with a real Photon
      2 but no sensor, flash <code>firmware/hantelSim/hantelSim.cpp</code>. It publishes exactly the
      same events and variables as the real firmware.
    </p>
    <p>
      Follow <code>docs/particle-setup.md</code> for credentials and MongoDB, set
      <code>APP_MODE=live</code> in your local environment, then restart.
    </p>
  </section>
  <section class="panel guide-card">
    <span class="step-number">03 / CONNECT</span>
    <h2>Switch to the real dumbbell</h2>
    <p>
      Wire the LIS3DH (SDA=D0, SCL=D1, 3V3, GND) and flash
      <code>firmware/hantelApp/IoTHantel.cpp</code>. The web application does not change. The sensor
      badge shows whether the device found its sensor.
    </p>
    <blockquote>
      “Trace a training set from the firmware’s end event through validation and storage to the bar
      chart. Explain how reading the variables and resetting the total differ from event
      collection.”
    </blockquote>
  </section>
  <section class="panel guide-card">
    <span class="step-number">04 / SHARE</span>
    <h2>Take it into the world</h2>
    <p>
      Deploy one server per team using <code>render.yaml</code>. Free instances sleep after 15
      minutes without incoming requests; sets finished during sleep are not recorded. Paid compute
      can collect without an open dashboard.
    </p>
    <p>
      Public controls are available to everyone. The only command resets the total count; stored
      sets stay in the history.
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
