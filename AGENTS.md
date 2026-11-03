# Working in this project

Read `README.md` first. Use `docs/architecture.md` and `docs/data-flow.md` when changing behavior, and `docs/configuration.md` for environment handling. Keep the project approachable for developers with limited programming experience; prefer small, named modules and clear explanations.

## Project conventions

- SvelteKit **3**, Svelte 5 runes, TypeScript, Node 24. Configure SvelteKit in `vite.config.ts`; use package `#lib/*` imports with explicit file extensions and `$app/tsconfig`. Do not copy SvelteKit 2 configuration patterns into the project.
- Routes/layouts live in `src/routes`; UI in `src/lib/components`; Particle and MongoDB integrations stay under `src/lib/server`. Use the official `mongodb` package.
- Application configuration is declared privately in `src/env.ts`, resolved at runtime through `$app/env/private`, and validated in `server/config.ts`. Keep `.env.example` and configuration docs aligned. Never read, print, commit or copy real secrets into prompts or client bundles.
- One collector per Node process, initialized at startup and skipped during builds. Keep one deployment instance; do not start streams in API/page requests, components or per browser tab.
- Device events enter through `normalizeEvent`; update the shared record type, repository mapping, mock device, chart and tests together when changing the sensor contract.
- Public controls intentionally have no login. Keep device/function targets fixed by server configuration, validate allowed arguments, preserve same-origin POST checks and the command budget. Physical actuator safeguards belong in firmware.
- Preserve bounded queues, queries, retry delays and graceful cleanup. Do not imply disconnected events are replayed or make a lossless-ingestion claim.
- Mock mode must work without Particle/MongoDB accounts. Live mode must fail clearly on missing configuration. Do not silently fall back to mock after a live integration fails.

## Validation and documentation

Run `npm run check`, `npm test`, `npm run build`, and `npm run test:smoke` for changes affecting application behavior. Tests must exercise meaningful boundaries/failure cases rather than copy implementation. Cloud credentials are not needed for these checks. State explicitly when hardware/cloud behavior was not tested.

Update the relevant `docs/` pages when changing data flow, configuration, payload contracts or deployment assumptions. Explain the observable change and how to verify it. Keep installation instructions usable on macOS/Linux and Windows.

## Shared skill

For adding/changing a sensor, variable or actuator, read `.agents/skills/add-iot-feature/SKILL.md`. This is the canonical copy; `.github/skills/add-iot-feature` and `.claude/skills/add-iot-feature` link to it. Use `npm run skills:setup -- --copy` where symlinks cannot be used; rerun it after canonical skill changes. Do not maintain divergent instructions per tool.
