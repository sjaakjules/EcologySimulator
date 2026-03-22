import {
  allocatePointBudget,
  buildInterleavedIndexOrder,
  circleOfConfusion,
  clampPointSizeToRange,
  pointBudgetCaps,
  recommendedBudgetPreset,
  resolvePointBudget,
  visiblePointCount
} from '../src/point-cloud';

describe('point cloud helpers', () => {
  it('never allocates more than the selected point budget', () => {
    const budget = resolvePointBudget('balanced', pointBudgetCaps.balanced);
    const allocation = allocatePointBudget(budget, 400_000, 220_000);

    expect(allocation.entityPoints + allocation.relationPoints).toBeLessThanOrEqual(budget);
    expect(allocation.droppedPoints).toBeGreaterThan(0);
  });

  it('builds a stable interleaved order for the same counts', () => {
    const first = buildInterleavedIndexOrder([3, 1, 2]);
    const second = buildInterleavedIndexOrder([3, 1, 2]);

    expect([...first]).toEqual([...second]);
    expect([...first]).toEqual([0, 1, 2, 0, 2, 0]);
  });

  it('clamps visible point count and point size to valid ranges', () => {
    expect(visiblePointCount(0, 0.5, 4)).toBe(0);
    expect(visiblePointCount(120, 0, 8)).toBeGreaterThanOrEqual(8);
    expect(clampPointSizeToRange(120, [1, 64])).toBe(64);
    expect(clampPointSizeToRange(0.4, [1, 64])).toBe(1);
  });

  it('keeps circle of confusion bounded and recommends a conservative preset on weak capabilities', () => {
    expect(circleOfConfusion(40, 40, 1.2)).toBe(0);
    expect(circleOfConfusion(20, 80, 1.4)).toBeLessThanOrEqual(1);
    expect(recommendedBudgetPreset(false, [1, 32], 4096, 0)).toBe('preview');
    expect(recommendedBudgetPreset(true, [1, 96], 16384, 8)).toBe('dense');
  });
});
