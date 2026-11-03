---
name: add-iot-feature
description: Add or change a Particle sensor, variable or actuator in this IoT template across firmware, validated ingestion, MongoDB, mock mode and the SvelteKit dashboard.
---

# Add an IoT feature

Read the root `AGENTS.md`, `docs/data-flow.md` and the modules involved in the requested change. Use `docs/architecture.md` for lifecycle/storage details and `docs/particle-setup.md` when changing the device contract.

Translate the requested physical behavior into a concrete contract: event name and payload, measurement type/unit/range, publication frequency, exposed variable, and any command with its allowed arguments. Infer routine choices from the existing project; ask only where a missing decision materially changes device behavior. Keep the scope the user requested.

Implement a complete path through the affected layers:

- Firmware registration, publication and input validation. Actuators need a firmware-enforced timeout and disconnected safe state appropriate to the requested device.
- Shared `Reading`/API types and the counter-specific `normalizeEvent` extension point. Particle prefix filtering does not replace exact event/device checks. Keep publication and receipt timestamps distinct.
- MongoDB document mapping, indexes/query bounds and an explicit plan for old data if the schema changes. Do not reinterpret old counter records as another measurement or delete history without authorization.
- Server-side variable/function methods and allowed arguments. Public API callers must not select arbitrary Particle functions, devices or URLs.
- Mock-device behavior, chart/labels, controls and useful user feedback. Mock mode must still start with no cloud credentials.
- `.env.example`, payload documentation and any affected project examples or smoke assertions.

Reuse authentication, reconnection and queue lifecycle rather than adding a second collector. Preserve server-only credentials, one-instance operation, bounded retries and visible failure status. Do not claim that reconnecting recovers events missed during downtime.

Verify valid and malformed payloads, relevant command limits/failures and mock end-to-end behavior. Run the repository checks listed in `AGENTS.md`; report which checks passed and whether real hardware/cloud testing remains. Explain the resulting data flow in a few clear sentences, naming the files they are most likely to change next.
