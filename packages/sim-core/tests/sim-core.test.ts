import { rawMountainAshBundle } from '@ecology/content-mountain-ash';
import { normalizeBundle } from '@ecology/schema';

import { createSimulationRuntime, generateWorld } from '../src/index';

describe('generateWorld', () => {
  const bundle = normalizeBundle(rawMountainAshBundle);

  it('creates a deterministic one-of-each tuning world for the same seed', () => {
    const config = { seed: 11, presetId: bundle.defaultWorldPresetId, viewMode: 'tuning_standard' as const };
    const first = generateWorld(bundle, config);
    const second = generateWorld(bundle, config);

    expect(first.anchors.map((anchor) => anchor.id)).toEqual(second.anchors.map((anchor) => anchor.id));
    expect(first.anchors.map((anchor) => anchor.position)).toEqual(second.anchors.map((anchor) => anchor.position));
    expect(first.chunks.map((chunk) => chunk.anchorIds.length)).toEqual(second.chunks.map((chunk) => chunk.anchorIds.length));
    expect(first.anchors.length).toBe(bundle.entities.length);
    expect(first.entityTypeIndex.LargeOldEucalyptTree).toHaveLength(1);
  });

  it('keeps direct nested children spatially close to their host in the tuning scene', () => {
    const tuningWorld = generateWorld(bundle, {
      seed: 9,
      presetId: bundle.defaultWorldPresetId,
      viewMode: 'tuning_standard'
    });

    const host = tuningWorld.anchorIndex.LargeOldEucalyptTree;
    const hollow = tuningWorld.anchorIndex.HollowCavity;

    expect(host).toBeDefined();
    expect(hollow).toBeDefined();
    expect(hollow?.nestedParentAnchorId).toBe('LargeOldEucalyptTree');
    expect(Math.abs((hollow?.position[0] ?? 0) - (host?.position[0] ?? 0))).toBeLessThan(4);
    expect(Math.abs((hollow?.position[1] ?? 0) - (host?.position[1] ?? 0))).toBeLessThan(4);
  });

  it('changes hectare patch counts when an override changes', () => {
    const base = generateWorld(bundle, {
      seed: 7,
      presetId: bundle.defaultWorldPresetId,
      viewMode: 'hectare_patch'
    });
    const overridden = generateWorld(bundle, {
      seed: 7,
      presetId: bundle.defaultWorldPresetId,
      viewMode: 'hectare_patch',
      generationOverrides: { LargeOldEucalyptTree: 14 }
    });

    expect(overridden.entityTypeIndex.LargeOldEucalyptTree.length).toBeGreaterThan(base.entityTypeIndex.LargeOldEucalyptTree.length);
  });
});

describe('SimulationRuntime', () => {
  const bundle = normalizeBundle(rawMountainAshBundle);

  it('keeps fixed anchors spatially stable across day ticks', () => {
    const runtime = createSimulationRuntime(bundle, {
      seed: 21,
      presetId: bundle.defaultWorldPresetId,
      viewMode: 'tuning_standard'
    });
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
    const runtime = createSimulationRuntime(bundle, {
      seed: 8,
      presetId: bundle.defaultWorldPresetId,
      viewMode: 'tuning_standard'
    });

    runtime.triggerDisturbance('wildfire', 0.8);
    const snapshot = runtime.getSnapshot();

    expect(snapshot.metrics.phase).toBe('release');
    expect(snapshot.metrics.disturbancePressure).toBeGreaterThan(0.4);
    expect(snapshot.viewMode).toBe('tuning_standard');
  });
});
