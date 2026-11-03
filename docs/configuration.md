# Configuration and secrets

Copy `.env.example` to `.env` for local development. Vite loads it during development; `npm start` uses Node’s optional env-file flag. Existing process environment values take precedence in production. The starter does not read `.env.production` or other extra files through the production start command.

SvelteKit 3 declarations in `src/env.ts` make application variables private and runtime-resolved. `server/config.ts` applies defaults and validates the complete configuration. Live-only credentials remain optional at build time, so a build does not need production secrets. When the server starts in live mode, missing/invalid values cause a clear startup error naming variables without printing their contents.

| Variable                 | Default                                                       | Meaning                                                                             |
| ------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `APP_MODE`               | `mock`                                                        | Exactly `mock` or `live`; a typo is an error                                        |
| `PARTICLE_CLIENT_ID`     | empty                                                         | Two-legged OAuth client ID; required live                                           |
| `PARTICLE_CLIENT_SECRET` | empty                                                         | OAuth client secret; required live                                                  |
| `PARTICLE_DEVICE_ID`     | simulator ID in mock                                          | 24-character hexadecimal Photon 2 ID; required live                                 |
| `PARTICLE_PRODUCT_ID`    | empty                                                         | Optional product ID/slug; leave blank for personal Sandbox devices                  |
| `PARTICLE_EVENT_NAME`    | `CounterEvent`                                                | Exact event to accept; stream prefix is checked again                               |
| `PARTICLE_VARIABLE_NAME` | `counter`                                                     | Only device variable exposed by the read endpoint                                   |
| `PARTICLE_FUNCTION_NAME` | `setCounter`                                                  | Only function exposed by reset; argument stays fixed at `"0"`                       |
| `MONGODB_URI`            | empty                                                         | MongoDB URI, including credentials; required live                                   |
| `MONGODB_DATABASE`       | `iot_starter`                                                 | Database containing the `readings` collection                                       |
| `READING_RETENTION_DAYS` | `7`                                                           | Integer 1–365; expiration age for newly inserted live records                       |
| `APP_ORIGIN`             | request-derived in dev; local URL or Render URL in production | Exact allowed browser origin for JSON commands, e.g. `https://example.onrender.com` |
| `HOST`                   | adapter default                                               | Set `0.0.0.0` on Render; keep local Vite bound to loopback                          |
| `PORT`                   | adapter default                                               | Production listen port; Render supplies its own                                     |
| `SHUTDOWN_TIMEOUT`       | adapter default                                               | Adapter HTTP connection-drain timeout in seconds                                    |

`HOST`, `PORT` and `SHUTDOWN_TIMEOUT` belong to adapter-node. `APP_ORIGIN` is this application's private runtime setting for checking JSON control requests. It is not the old adapter-node `ORIGIN` variable, which SvelteKit 3 removed. `scripts/start.mjs` defaults it to Render’s `RENDER_EXTERNAL_URL`, or `http://127.0.0.1:3000` locally (using `PORT` if set). Open that exact local origin when using `npm start`. Set `APP_ORIGIN` explicitly for a custom domain. During `npm run dev`, leave it unset so the Vite request origin is used.

Reset uses JSON and performs its own strict origin check against this setting. SvelteKit’s default form-origin protection remains enabled; its `paths.origin` setting is separate build-time configuration, not required by this JSON endpoint.

Never add credentials to `PUBLIC_*` or `VITE_*` variables, source files, agent prompts, screenshots or committed documents. Do not send tokens to the browser, including in a Particle stream URL. The browser only calls this application’s own API. `.gitignore` excludes real `.env` files; `.env.example` contains placeholders only.

Use a different Particle client, Atlas database user and deployment per team. If a secret is accidentally committed, rotate it at its provider; removing the latest file does not remove the secret from Git history.

Mock mode ignores cloud credentials and uses an in-memory store. Switching to live mode does not migrate its sample data.
