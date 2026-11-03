# Project guide

## Understand the working example first

Start in mock mode. Watch the current-set card count up during a simulated set, then see a new bar and table row appear after the set ends. Read the device, reset the total, and notice that the stored sets stay. Read [data flow](data-flow.md), then find the corresponding modules in your editor.

Use Git commits to save a working baseline and each meaningful change. Before asking an agent to implement, describe the physical behavior and what a person should see or control. Ask it to explain the affected files and how to test the result.

## The dumbbell contract

The firmware (`IoTHantel.cpp`), the simulator firmware (`hantelSim.cpp`), the mock device, the server and the dashboard share this contract:

| Part              | Current behavior                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Measurement       | LIS3DH acceleration at 20 Hz; a repetition is a smoothed Y-axis swing from below 0.5 to above 2 m/s² |
| Set start         | Third regular repetition (0.6–4 s apart), at least 3 s after the first; publishes `start`            |
| Set end           | Five seconds without a repetition; publishes `end` with repetitions and duration                     |
| Event             | `training`, with JSON data such as `{"type":"end","reps":12,"duration":22,"total":132}`              |
| Variables         | `repetitions`, `totalCount`, `sensorOk`, read using **Read device now** and automatically            |
| Function          | `resetTotal("0")`, called using **Reset total count** after a confirmation                           |
| Persistence       | `totalCount` survives restarts in the device’s EEPROM; sets are stored by the server                 |
| History           | Type, repetitions, duration, total, device ID, event name, publication time and receipt time         |
| Dashboard refresh | History every ten seconds; device every five seconds during a set, otherwise every 30 seconds        |

Follow one training set through the code:

1. The firmware counts repetitions and publishes `training` at the start and end of a set. In mock mode, `src/lib/server/mock.ts` simulates the same rules.
2. `src/lib/server/particle/client.ts` receives the event stream from Particle Cloud. `src/lib/server/collector.ts` passes each event to `normalizeEvent` in `src/lib/server/training-events.ts`.
3. `normalizeEvent` checks the device, exact event name, JSON payload, value limits from `src/lib/server/hantel.ts` and the timestamp. It creates a `TrainingEvent`, defined in `src/lib/types.ts`.
4. `src/lib/server/write-queue.ts` queues the event. Live mode stores it through `src/lib/server/mongodb/training-events.ts`; mock mode uses the in-memory repository.
5. `src/routes/api/trainings/+server.ts` returns the stored events of the selected range. In the browser, `src/lib/training.ts` turns `end` events into sets and statistics, and `SetChart.svelte` draws one bar per set.
6. The state and reset endpoints in `src/routes/api/device/` make separate, on-demand device requests. Reading does not add history; reset changes only the device total.

Try reading the device, resetting the total and switching the history range. These are three different actions: observing the device, changing its total, and changing only what the dashboard displays.

## Work with an agent

Follow [agent setup](agentic-coding.md), then try:

> Trace a training set from the firmware’s end event through validation and storage to the bar chart. Explain how reading the device variables and resetting the total differ from event collection. Point me to the relevant files without changing the code.

Useful follow-ups:

- “Explain why the total card can be higher than the sum of all stored sets.”
- “Show what happens when the database is unavailable and how I can detect dropped events.”
- “Explain how the dashboard decides that a set is in progress.”

Never paste `.env`, tokens or database passwords into a prompt. Share variable names and sanitized diagnostics instead. Inspect the diff and ask the agent to explain code you do not understand. The goal is to build an application you can describe and demonstrate.

## Extend the dumbbell

When you are ready to change the project, use the `add-iot-feature` skill and describe the new event payload, measurement type, unit, range, publication frequency and any device commands.

Update both firmwares, the shared `TrainingEvent` type, validation, MongoDB mapping, mock device, UI and documentation together. Plan how to handle existing records if the schema changes. Verify the revised contract in mock mode, then with the simulator firmware, before connecting the sensor.

## Demonstrate your project

Explain the physical input, the event contract, the server validation, storage and dashboard behavior. Show one normal set, an invalid-input case in tests, and what the app displays when the device is disconnected or the sensor is missing. State whether your hosting collects unattended and where gaps can occur.
