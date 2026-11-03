# Troubleshooting

| Symptom                                              | Check                                                                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation fails with an engine error              | Use Node 24 (`node --version`); `.nvmrc` selects it for nvm                                                                                                            |
| An old SvelteKit tutorial disagrees with the project | This is SvelteKit 3: Vite plugin configuration, explicit env variables, `#lib` imports and `$app/tsconfig`                                                             |
| Server refuses to start in live mode                 | Read the missing/invalid variable names. Check `.env` or Render environment settings and restart                                                                       |
| Live collector keeps retrying authentication         | Check client ID/secret, two-legged client type, device ownership/product permissions; do not repeatedly create tokens manually                                         |
| Collector connects but no readings arrive            | Confirm event in Particle Console, exact event name, device ID and payload format. `CounterEvent/debug` is deliberately not accepted as `CounterEvent`                 |
| Rejected count increases                             | Payload must match the server contract: nonnegative decimal counter string up to 2,147,483,647 and valid timestamp for this example. Review firmware and mapping tests |
| Particle rate limit                                  | Let the backoff run. Clients behind one public IP share Particle limits; avoid opening multiple development servers                                                    |
| Variable read fails                                  | Device must be online and expose the configured variable. A stored latest event can exist while the device is offline                                                  |
| Reset cannot be confirmed                            | Read the variable before retrying; a timeout does not prove the device ignored the command                                                                             |
| Reset returns 403                                    | Use the app’s button. Check `APP_ORIGIN` matches the public HTTPS URL, particularly with a custom domain                                                               |
| Device requests return 429                           | Read/reset share 20 requests per minute per process. Wait one minute                                                                                                   |
| History returns 503 or a database error appears      | Verify URI, password encoding, database-user permissions and Atlas IP access list, including Render egress ranges                                                      |
| Queue/dropped count rises                            | The database is slow/unavailable or arrival rate exceeds capacity. The in-memory queue is bounded and may drop records; fix the cause before increasing capacity       |
| Chart is empty after clearing                        | Wait for a new event or change the history range/reload. Database records were not deleted                                                                             |
| A long range omits early readings                    | The API returns the newest bounded window (120 by default), not every record or aggregated samples across the whole range                                              |
| Readings disappeared after restart                   | Mock data is temporary. Live data persists in Atlas, subject to retention and provider limits                                                                          |
| Gaps appeared while browser was closed               | Render Free sleeps after 15 idle minutes. The stream cannot collect while the process is stopped                                                                       |
| More than one stream or duplicate activity           | Stop extra dev servers and keep Render at one instance/process. Do not use a separate collector alongside this one                                                     |
| Skill is not discovered                              | Run `npm run skills:setup`; on Windows use `npm run skills:setup -- --copy`; reopen the extension session                                                              |

Inspect `/api/status` for connection state, last event/write times, pending writes, received/saved/rejected/duplicate/dropped counters and reconnects. Counters describe the current process session. `/api/health` reports only HTTP server liveness; it does not assert the device or database is healthy.

To isolate a problem, start with mock mode, then verify Particle Console, then MongoDB access, then the deployed server. Do not publish full upstream errors or screenshots containing credentials.
