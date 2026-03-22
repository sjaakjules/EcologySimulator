/// <reference lib="webworker" />

import { createSimulationRuntime } from '@ecology/sim-core';
import type { NormalizedBundle } from '@ecology/schema';
import type { SimulationCommand, SimulationEvent } from '@ecology/worker-runtime';
import { transferableForSnapshot } from '@ecology/worker-runtime';

let runtime: ReturnType<typeof createSimulationRuntime> | undefined;
let intervalHandle: ReturnType<typeof setInterval> | undefined;
let lastBundle: NormalizedBundle | undefined;

function postSnapshot(type: 'FrameSnapshot' | 'WorldGenerated' = 'FrameSnapshot') {
  if (!runtime) {
    return;
  }

  const snapshot = runtime.getSnapshot();
  const event =
    type === 'WorldGenerated'
      ? ({
          type,
          snapshot,
          seed: snapshot.worldSeed,
          presetId: runtime.getWorld().presetId
        } satisfies SimulationEvent)
      : ({ type, snapshot } satisfies SimulationEvent);

  self.postMessage(event, transferableForSnapshot(snapshot));
}

function clearPlaybackLoop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = undefined;
  }
}

self.onmessage = (event: MessageEvent<SimulationCommand>) => {
  const command = event.data;

  switch (command.type) {
    case 'LoadBundle': {
      clearPlaybackLoop();
      lastBundle = command.bundle;
      runtime = createSimulationRuntime(command.bundle, command.config);
      postSnapshot('WorldGenerated');
      break;
    }
    case 'GenerateWorld': {
      if (!runtime || !lastBundle) {
        break;
      }
      runtime.rebuild(lastBundle, command.config);
      postSnapshot('WorldGenerated');
      break;
    }
    case 'PlayPauseScrub': {
      if (!runtime) {
        break;
      }

      clearPlaybackLoop();
      if (typeof command.absoluteDay === 'number') {
        runtime.advanceDay(command.absoluteDay);
        postSnapshot();
      }

      if (command.playing) {
        intervalHandle = setInterval(() => {
          runtime?.advanceDay(1);
          postSnapshot();
        }, 400);
      }
      break;
    }
    case 'AdvanceTicks': {
      runtime?.advanceDay(command.days);
      postSnapshot();
      break;
    }
    case 'ApplyAuthoringPatch': {
      clearPlaybackLoop();
      lastBundle = command.bundle;
      runtime = createSimulationRuntime(command.bundle, command.config);
      postSnapshot('WorldGenerated');
      break;
    }
    case 'TriggerDisturbance': {
      runtime?.triggerDisturbance(command.disturbance, command.intensity);
      postSnapshot();
      break;
    }
    case 'DescribeSelection': {
      const overlay = runtime?.describeSelection(command.selection);
      self.postMessage({ type: 'SelectionOverlay', overlay } satisfies SimulationEvent);
      break;
    }
  }
};
