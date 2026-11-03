# Fieldwork · IoT dumbbell

An IoT dumbbell built on a Particle Photon 2 with an LIS3DH acceleration sensor. The firmware counts repetitions and recognizes training sets; this web application stores every set and shows your current set, history and totals. It started from a counter template for agentic coding.

The application uses **SvelteKit 3, Svelte 5, TypeScript and the official MongoDB Node driver**. A server-side collector subscribes directly to Particle events; **no webhook is required**. Render runs the application as one Node process per project.

## What works

- Receive `training` events (`start` / `end` of a set, as JSON), validate them and store them.
- Show the current set live, the device total, today’s repetitions, a bar chart per set (24 hours, 7 or 30 days) and a table of recent sets with duration and pace.
- Read the variables `repetitions`, `totalCount` and `sensorOk`, and call `resetTotal("0")` from public controls. Stored sets are never deleted by a reset.
- Run without accounts in mock mode: a server-side simulated dumbbell and an in-memory store.
- Test the cloud path on a real Photon 2 without the sensor using the simulator firmware `firmware/hantelSim/hantelSim.cpp`.
- Switch to live mode with two-legged Particle authentication and MongoDB Atlas.
- Use Copilot, Codex or Claude Code with shared project instructions and an `add-iot-feature` skill.

## Quick start

Install **Node.js 24 LTS** and Git. Use your own copy of this repository; each team should have separate credentials, database and deployment.

```sh
npm ci
cp .env.example .env
npm run dev
```

In PowerShell, use `Copy-Item .env.example .env`. Open the local URL printed by Vite (usually <http://127.0.0.1:5173>). On a fresh clone, `APP_MODE=mock` works even without an `.env` file. The simulated dumbbell starts its first set a few seconds after startup, then trains a set of 8–15 repetitions every 20–40 seconds, following the same rules as the firmware. It also seeds fifteen earlier sets from the last week. The dashboard refreshes its history every ten seconds and reads the device every five seconds while a set is running.

To connect hardware, follow [Particle setup](docs/particle-setup.md) and [configuration](docs/configuration.md). Flash the simulator firmware first, then the real firmware. Restart the server after changing `.env`.

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
src/lib/components/            Set chart and reusable UI
src/lib/training.ts            Sets, statistics and live state (server and browser)
src/lib/server/hantel.ts       Device contract: variables, limits, reset argument
src/lib/server/training-events.ts  Event validation (normalizeEvent) and memory store
src/lib/server/particle/       Token exchange, REST calls and event stream
src/lib/server/mongodb/        MongoDB client and training event repository
src/lib/server/collector.ts    Receive → validate → queue → store
src/lib/server/runtime.ts      One collector/store/device per server instance
src/env.ts                    Explicit private runtime environment declarations
firmware/hantelApp/            Dumbbell firmware with the LIS3DH sensor
firmware/hantelSim/            Simulator firmware: same contract, no sensor
firmware/counter/counter.cpp   Original counter example from the template
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
- **Mock history is temporary.** It holds at most 2,000 records and resets on restart. Live history is stored in MongoDB, with 30-day retention by default.
- **No lossless-delivery claim.** The queue is bounded and lives in memory. The UI reports rejected/dropped records. A set that ends while the server is offline is missing from the history; the device total still includes it. See the detailed failure behavior in the architecture document.
- **Physical safety belongs on the device.** A pump must have a firmware-enforced maximum run time and a safe state if connectivity fails.

The original template followed the counter behavior in the supplied Node-RED flow. The [Particle Node-RED package](https://github.com/mmeisterhans/node-red-contrib-particle-cloud) informed the two-legged authentication approach; it is not a dependency of this application.
