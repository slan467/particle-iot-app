# Deploy on Render

The deployment target is a persistent Node server on **Render**. It maintains a long-lived outbound Particle SSE subscription. No Particle webhook or separate collector service is required.

## Deploy a mock demonstration

1. Push your own copy of this repository to GitHub. Do not commit `.env`.
2. In Render, create a **Blueprint** from that repository and select `render.yaml`. It requests one free Node web service.
3. Allow the build to run `npm ci --include=dev`, diagnostics, tests and the production build. Including development dependencies is necessary for the SvelteKit build tools even if the host sets `NODE_ENV=production`. The start command is `npm start`.
4. Open the generated HTTPS URL. It should show the simulated Photon 2, sample history and working controls.

Alternatively, create a Node Web Service manually with the commands from `render.yaml`, Node 24, `HOST=0.0.0.0`, and health-check path `/api/health`. Leave the platform-provided `PORT` intact.

## Switch the service to live mode

Configure the Photon and Atlas first using [Particle setup](particle-setup.md). In the Render service’s environment settings, add:

- `APP_MODE=live`
- `PARTICLE_CLIENT_ID`, `PARTICLE_CLIENT_SECRET`, `PARTICLE_DEVICE_ID`
- `MONGODB_URI`, `MONGODB_DATABASE`
- Optional event/function/variable names and product ID if changed from the example

Use Render’s secret environment settings for credential values, not `render.yaml`. Add the service’s **outbound IP ranges** to the Atlas Network Access list. See [Render outbound IPs](https://render.com/docs/outbound-ip-addresses). Your local computer’s IP entry does not cover Render.

`scripts/start.mjs` uses Render’s `RENDER_EXTERNAL_URL` as `APP_ORIGIN` automatically. If you attach a custom domain, explicitly set `APP_ORIGIN` to that public HTTPS origin without a trailing slash. A wrong origin causes reset requests to be rejected.

Save and restart/redeploy. Verify `/api/status`, the dashboard, a fresh event, and a variable read. Credentials are runtime configuration: the build does not need to contact Particle or MongoDB. Keep `APP_MODE=live` in the actual deployed environment; a later Blueprint sync should preserve your intended setting (update the non-secret value in your own `render.yaml` if using Blueprint-managed configuration).

## Free and paid behavior

As documented by Render in November 2026, a Free service sleeps after 15 minutes without incoming HTTP requests or WebSocket messages. An open dashboard polls every ten seconds and generates normal incoming requests. When the dashboard closes, collection can continue until spin-down. Do not rely on the outbound Particle SSE subscription to prevent sleep.

While sleeping, the collector is stopped and events are missed. A later request wakes the server, usually with a cold-start delay of roughly a minute. Mock history resets; MongoDB history remains. Free instance hours, bandwidth and build limits also apply. For a strict zero-spend setup, use only the Free instance and avoid attaching a payment method; Render documents suspension instead of overage billing when no payment method is present. Check current provider terms before deployment.

Upgrading this service’s **compute instance** to a paid type removes inactivity spin-down. Upgrading only the workspace subscription does not. Paid instances can collect without visitors, but deployments, network outages and restarts can still interrupt an event subscription. This template reconnects; it does not replay missing events.

Keep **one instance and one Node process** per team. Do not enable autoscaling, Node clustering, or an additional background collector pointing at the same project. Deployments can briefly overlap old and new processes; database fingerprints suppress identical observations, but this is not a leader-election system.

## Update and inspect

The CI workflow checks TypeScript, unit tests, build and a mock production HTTP smoke test without secrets. Render’s build also runs checks/tests. Review deploy logs for startup configuration errors and collector connection messages. The health endpoint checks liveness only; `/api/status` reports Particle connectivity, write health and queue/drop counters.

The adapter handles SIGTERM/SIGINT and emits a shutdown event. The collector closes its stream and gives queued writes a bounded drain period before closing MongoDB. Never use local files on Render to persist readings.

References: [Render Free](https://render.com/docs/free), [Render FAQ](https://render.com/docs/faq), [SvelteKit adapter-node](https://svelte.dev/docs/kit/adapter-node).
