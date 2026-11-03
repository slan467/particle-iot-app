# Project guide

## Understand the working example first

Start in mock mode. Read the variable, reset the counter, clear the chart, and watch the next event arrive. Observe that clearing the chart does not change the variable. Read [data flow](data-flow.md), then find the corresponding modules in your editor.

Use Git commits to save a working baseline and each meaningful change. Before asking an agent to implement, describe the physical behavior and what a person should see or control. Ask it to explain the affected files and how to test the result.

## The implemented counter example

The firmware, mock device, server and dashboard share this contract:

| Part              | Current behavior                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Value             | Nonnegative integer counter up to 2,147,483,647; stops at that limit without wrapping         |
| Increment         | Every 100 ms (approximately ten increments per second)                                        |
| Event             | `CounterEvent`, with a decimal string such as `"42"` as its data                              |
| Publication       | Every 100 increments (approximately ten seconds); reset to zero is published on the next loop |
| Variable          | `counter`, read on demand using **Get counter value**                                         |
| Function          | `setCounter("0")`, called using **Reset counter to 0**                                        |
| History           | Counter value, device ID, event name, publication time and receipt time                       |
| Dashboard refresh | Every ten seconds, independently of device publication                                        |

Follow a counter reading through the code:

1. `firmware/counter/counter.cpp` increments the counter and publishes `CounterEvent`. In mock mode, `src/lib/server/mock.ts` simulates this behavior.
2. `src/lib/server/particle/client.ts` receives the event stream from Particle Cloud. `src/lib/server/collector.ts` passes each event to `normalizeEvent` in `src/lib/server/readings.ts`.
3. `normalizeEvent` checks the device, exact event name, numeric value and timestamp. It creates a `Reading`, defined in `src/lib/types.ts`.
4. `src/lib/server/write-queue.ts` queues the reading. Live mode stores it through `src/lib/server/mongodb/readings.ts`; mock mode uses the in-memory repository.
5. `src/routes/api/readings/+server.ts` returns recent stored readings and the latest value. The dashboard polls this endpoint and displays the counter card, chart and event table.
6. The variable and reset endpoints in `src/routes/api/device/` make separate, on-demand device requests. Reading the variable does not add history; reset requests a new device publication.

Try reading the variable, resetting the counter and clearing the chart. These are three different actions: observing the device, changing its counter, and changing only the displayed chart.

## Work with an agent

Follow [agent setup](agentic-coding.md), then try:

> Trace the existing CounterEvent from the Photon 2 firmware through validation and storage to the dashboard. Explain how the counter variable read and reset function differ from event collection. Point me to the relevant files without changing the code.

Useful follow-ups:

- “Explain why the variable card and latest-event card can show different values.”
- “Show what happens when the database is unavailable and how I can detect dropped readings.”
- “Explain why clearing the chart does not reset the counter or delete stored readings.”

Never paste `.env`, tokens or database passwords into a prompt. Share variable names and sanitized diagnostics instead. Inspect the diff and ask the agent to explain code you do not understand. The goal is to build an application you can describe and demonstrate.

## Adapt the counter to another application

When you are ready to change the project, use the `add-iot-feature` skill and describe the new event payload, measurement type, unit, range, publication frequency and any device commands. These would be changes to the counter implementation described above.

Update the firmware, shared `Reading` type, validation, MongoDB mapping, mock device, UI and documentation together. Plan how to handle existing counter records if the schema changes. Verify the revised contract in mock mode before connecting hardware. For actuators, enforce operating limits and a disconnected safe state in firmware.

## Demonstrate your project

Explain the physical input, the event contract, the server validation, storage and dashboard behavior. Show one normal reading, an invalid-input case in tests, and what the app displays when the device is disconnected. State whether your hosting collects unattended and where gaps can occur.
