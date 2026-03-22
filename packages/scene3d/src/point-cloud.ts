import type { RenderPointBudgetPreset } from '@ecology/worker-runtime';

export const pointBudgetCaps: Record<RenderPointBudgetPreset, number> = {
  preview: 131_072,
  balanced: 262_144,
  dense: 524_288,
  million: 1_048_576
};

export interface PointBudgetAllocation {
  entityPoints: number;
  relationPoints: number;
  droppedPoints: number;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function resolvePointBudget(preset: RenderPointBudgetPreset, maxPoints: number) {
  const presetCap = pointBudgetCaps[preset];
  return clamp(Math.round(maxPoints || presetCap), 16_384, presetCap);
}

export function allocatePointBudget(
  maxPoints: number,
  requestedEntityPoints: number,
  requestedRelationPoints: number,
  entityShare = 0.68
): PointBudgetAllocation {
  const entityTarget = Math.min(requestedEntityPoints, Math.max(0, Math.round(maxPoints * entityShare)));
  const relationTarget = Math.min(requestedRelationPoints, Math.max(0, maxPoints - entityTarget));
  const unused = maxPoints - entityTarget - relationTarget;
  const extraEntity = Math.min(requestedEntityPoints - entityTarget, Math.max(0, unused));
  const entityPoints = entityTarget + extraEntity;
  const relationPoints = Math.min(requestedRelationPoints, Math.max(0, maxPoints - entityPoints));
  const droppedPoints = Math.max(0, requestedEntityPoints + requestedRelationPoints - entityPoints - relationPoints);

  return {
    entityPoints,
    relationPoints,
    droppedPoints
  };
}

export function allocateWeightedCounts(weights: number[], total: number, minEach: number) {
  if (weights.length === 0 || total <= 0) {
    return new Array(weights.length).fill(0);
  }

  const counts = new Array(weights.length).fill(0);
  const positiveMin = Math.max(0, Math.floor(minEach));
  let remaining = Math.max(0, Math.floor(total));

  for (let index = 0; index < weights.length && remaining > 0; index += 1) {
    const assigned = Math.min(positiveMin, remaining);
    counts[index] = assigned;
    remaining -= assigned;
  }

  if (remaining <= 0) {
    return counts;
  }

  const normalizedWeights = weights.map((weight) => Math.max(weight, 0.0001));
  const weightSum = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  const fractions = normalizedWeights.map((weight) => (weight / weightSum) * remaining);
  const remainders = fractions.map((fraction, index) => ({
    fraction: fraction - Math.floor(fraction),
    index
  }));

  fractions.forEach((fraction, index) => {
    const whole = Math.floor(fraction);
    counts[index] += whole;
    remaining -= whole;
  });

  remainders
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
    .slice(0, remaining)
    .forEach(({ index }) => {
      counts[index] += 1;
    });

  return counts;
}

export function buildInterleavedIndexOrder(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  const order = new Int32Array(total);
  const maxCount = counts.reduce((max, count) => Math.max(max, count), 0);
  let cursor = 0;

  for (let level = 0; level < maxCount; level += 1) {
    for (let sourceIndex = 0; sourceIndex < counts.length; sourceIndex += 1) {
      if (level < counts[sourceIndex]!) {
        order[cursor] = sourceIndex;
        cursor += 1;
      }
    }
  }

  return order;
}

export function visiblePointCount(total: number, holarchyDepth: number, minimumVisible = 0) {
  if (total <= 0) {
    return 0;
  }

  const clampedDepth = clamp(holarchyDepth, 0, 1);
  const eased = 0.14 + clampedDepth * 0.86;
  return clamp(Math.round(total * eased), Math.min(minimumVisible, total), total);
}

export function clampPointSizeToRange(size: number, range: [number, number]) {
  return clamp(size, Math.max(1, range[0]), Math.max(1, range[1]));
}

export function circleOfConfusion(viewDistance: number, focusDistance: number, blurScale: number, maxBlur = 1) {
  if (viewDistance <= 0) {
    return 0;
  }

  return clamp((Math.abs(focusDistance - viewDistance) / viewDistance) * blurScale, 0, maxBlur);
}

export function recommendedBudgetPreset(
  isWebgl2: boolean,
  aliasedPointSizeRange: [number, number],
  maxTextureSize: number,
  maxVertexTextureImageUnits: number
): RenderPointBudgetPreset {
  if (!isWebgl2 || maxVertexTextureImageUnits < 4) {
    return 'preview';
  }

  if (maxTextureSize >= 16_384 && aliasedPointSizeRange[1] >= 96) {
    return 'dense';
  }

  return 'balanced';
}
