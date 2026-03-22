import { rawMountainAshBundle } from '@ecology/content-mountain-ash';
import { normalizeBundle } from '@ecology/schema';

import { createSimulationRuntime, generateWorld } from '../src/index';

describe('generateWorld', () => {
  const bundle = normalizeBundle(rawMountainAshBundle);

  it('is deterministic for the same seed', () => {
    const config = { seed: 11, presetId: bundle.defaultWorldPresetId };
    const first = generateWorld(bundle, config);
    const second = generateWorld(bundle, config);

    expect(first.anchors.map((anchor) => anchor.id)).toEqual(second.anchors.map((anchor) => anchor.id));
    expect(first.anchors.map((anchor) => anchor.position)).toEqual(second.anchors.map((anchor) => anchor.position));
    expect(first.chunks.map((chunk) => chunk.anchorIds.length)).toEqual(second.chunks.map((chunk) => chunk.anchorIds.length));
  });

  it('changes generated placements when an override changes', () => {
    const base = generateWorld(bundle, { seed: 7, presetId: bundle.defaultWorldPresetId });
    const overridden = generateWorld(bundle, {
      seed: 7,
      presetId: bundle.defaultWorldPresetId,
      generationOverrides: { LargeOldEucalyptTree: 14 }
    });

    expect(overridden.entityTypeIndex.LargeOldEucalyptTree.length).toBeGreaterThan(base.entityTypeIndex.LargeOldEucalyptTree.length);
  });
});

describe('SimulationRuntime', () => {
  const bundle = normalizeBundle(rawMountainAshBundle);

  it('keeps fixed anchors spatially stable across day ticks', () => {
    const runtime = createSimulationRuntime(bundle, { seed: 21, presetId: bundle.defaultWorldPresetId });
    const initial = runtime.getSnapshot();

    runtime.advanceDay(20);

    const updated = runtime.getSnapshot();

    initial.anchorIds.forEach((anchorId, index) => {
      if (initial.anchorFixed[index]) {
        expect(updated.positions[index * 3]).toBe(initial.positions[index * 3]);
        expect(updated.positions[index * 3 + 1]).toBe(initial.positions[index * 3 + 1]);
      }
    });
  });

  it('applies disturbance transitions deterministically', () => {
    const runtime = createSimulationRuntime(bundle, { seed: 8, presetId: bundle.defaultWorldPresetId });

    runtime.triggerDisturbance('wildfire', 0.8);
    const snapshot = runtime.getSnapshot();

    expect(snapshot.metrics.phase).toBe('release');
    expect(snapshot.metrics.disturbancePressure).toBeGreaterThan(0.4);
  });
});
