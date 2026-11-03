import * as env from '$app/env/private';
import type { DashboardSnapshot } from '../types';
import { parseConfig } from './config';
import { Collector } from './collector';
import { MemoryReadings } from './readings';
import { MockDevice } from './mock';
import { MongoReadings } from './mongodb/readings';
import { ParticleClient } from './particle/client';

async function createRuntime() {
  const config = parseConfig(env);
  const store = config.mode === 'mock' ? new MemoryReadings() : new MongoReadings(config);
  const device = config.mode === 'mock' ? new MockDevice(config) : new ParticleClient(config);
  if (device instanceof MockDevice) await device.seed(store);
  const collector = new Collector(config, store, device);
  collector.start();
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    process.removeListener('sveltekit:shutdown', stop);
    await collector.stop();
    await store.close();
  };
  process.once('sveltekit:shutdown', stop);
  return {
    config,
    device,
    collector,
    store,
    stop,
    async snapshot(
      since = new Date(Date.now() - 3600_000),
      limit = 120
    ): Promise<DashboardSnapshot> {
      const [readings, latest] = await Promise.all([store.list(since, limit), store.latest()]);
      return {
        status: { ...collector.status },
        readings,
        latest,
        eventName: config.eventName,
        variableName: config.variableName,
        functionName: config.functionName,
        deviceLabel:
          config.mode === 'mock' ? 'Photon 2 simulator' : `Photon 2 · …${config.deviceId.slice(-6)}`
      };
    }
  };
}

let runtime: ReturnType<typeof createRuntime> | undefined;
export function getRuntime() {
  return (runtime ??= createRuntime());
}

if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    if (runtime) await (await runtime).stop();
  });
}
