# Fieldwork · Particle IoT starter

A template for turning a Particle Photon 2 into a small IoT application with agentic coding. Start with a working counter, then adapt it into a garden monitor, home assistant or another connected project.

The application uses **SvelteKit 3, Svelte 5, TypeScript and the official MongoDB Node driver**. A server-side collector subscribes directly to Particle events; **no webhook is required**. Render runs the application as one Node process per project.

## What works

- Receive `CounterEvent`, validate the payload, display the latest counter and store history.
- Read the device’s `counter` variable and call `setCounter("0")` from public controls.
- Show a history chart, recent event table and collector health. Clearing the chart never deletes records.
- Run without accounts in mock mode: a server-side simulated device and an in-memory store.
- Switch to live mode with two-legged Particle authentication and MongoDB Atlas.
- Use Copilot, Codex or Claude Code with shared project instructions and an `add-iot-feature` skill.

## Quick start

Install **Node.js 24 LTS** and Git. Use your own copy of this repository; each team should have separate credentials, database and deployment.

```sh
npm ci
cp .env.example .env
npm run dev
```

In PowerShell, use `Copy-Item .env.example .env`. Open the local URL printed by Vite (usually <http://127.0.0.1:5173>). On a fresh clone, `APP_MODE=mock` works even without an `.env` file. The simulated counter increments every 100 ms and publishes every 100 increments (approximately ten seconds), matching the firmware. The dashboard refreshes every ten seconds.

To connect hardware, follow [Particle setup](docs/particle-setup.md) and [configuration](docs/configuration.md). Restart the server after changing `.env`.

## Commands

| Command                | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`          | Local development with hot reload                                            |
| `npm run check`        | Svelte and TypeScript diagnostics                                            |
| `npm test`             | Collector, validation, authentication and transport tests; no cloud accounts |
| `npm run build`        | Create the Node production server                                            |
| `npm start`            | Run the built server; load `.env` if present                                 |
| `npm run test:smoke`   | Start an isolated production mock server and check HTTP behavior             |
| `npm run skills:setup` | Verify/repair skill links; `-- --copy` uses copies instead                   |
| `npm run format`       | Format TypeScript, Svelte and documentation consistently                     |

Browser tests run an isolated mock server on port 4179 and test desktop/mobile viewports. Build first, then install Chromium once with `npx playwright install chromium` and run `npm run test:browser`. Alternatively, use installed Chrome with `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` (PowerShell: `$env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:browser`). Screenshots and failure traces go to ignored `test-results/`. Tests use a temporary browser profile and do not access your personal browser session.

`npm run preview` is for previewing a build. Use `npm start` to verify the actual production startup and shutdown lifecycle.
For a local production run, open <http://127.0.0.1:3000> (or the port you configured).

## Project map

```text
src/routes/                    Pages, shared layout and HTTP endpoints
src/lib/components/            Dashboard chart and reusable UI
src/lib/server/particle/       Token exchange, REST calls and event stream
src/lib/server/mongodb/        MongoDB client and reading repository
src/lib/server/collector.ts    Receive → validate → queue → store
src/lib/server/runtime.ts      One collector/store/device per server instance
src/env.ts                    Explicit private runtime environment declarations
firmware/counter/counter.cpp   Photon 2 example firmware
docs/                         Architecture, setup and project documentation
.agents/skills/               Canonical shared agent skill
```

## Use and adapt

Start with the [project guide](docs/project-guide.md). Read [data flow](docs/data-flow.md) to relate Node-RED nodes to this application, then [architecture](docs/architecture.md) for the module boundaries. [Agent setup](docs/agentic-coding.md) explains the three VS Code extensions and symlink fallback.

Deployment instructions are in [deployment](docs/deployment.md). Runtime problems are covered in [troubleshooting](docs/troubleshooting.md).

## Operating assumptions

- **One instance.** Each server opens one Particle subscription. Horizontal scaling requires collector coordination first.
- **Public controls.** Everyone with access can use the configured buttons. Arguments and targets are restricted server-side; this is not user authentication.
- **Free hosting sleeps.** Render Free sleeps after 15 minutes without incoming traffic. Collection stops during sleep, outages and restarts; this application does not backfill missed Particle events. Paid compute removes idle sleep, not all possible interruptions.
- **Mock history is temporary.** It holds at most 2,000 records and resets on restart. Live history is stored in MongoDB, with seven-day retention by default.
- **No lossless-delivery claim.** The queue is bounded and lives in memory. The UI reports rejected/dropped records. See the detailed failure behavior in the architecture document.
- **Physical safety belongs on the device.** A pump must have a firmware-enforced maximum run time and a safe state if connectivity fails.

This template follows the counter behavior in the supplied Node-RED flow. The [Particle Node-RED package](https://github.com/mmeisterhans/node-red-contrib-particle-cloud) informed the two-legged authentication approach; it is not a dependency of this application.
