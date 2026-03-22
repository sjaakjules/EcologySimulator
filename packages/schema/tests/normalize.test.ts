import { rawMountainAshBundle } from '@ecology/content-mountain-ash';

import { normalizeBundle, rawContentBundleSchema } from '../src/index';

describe('normalizeBundle', () => {
  it('accepts the raw bundle as stored and preserves addressable content', () => {
    const parsed = rawContentBundleSchema.parse(rawMountainAshBundle);

    expect(parsed.entity_catalog.length).toBeGreaterThan(0);
    expect(parsed.relation_catalog.length).toBeGreaterThan(0);
  });

  it('normalizes scales, styles, and lookups for the runtime', () => {
    const normalized = normalizeBundle(rawMountainAshBundle);

    expect(normalized.entities.every((entity) => entity.homeScale)).toBe(true);
    expect(normalized.relations.every((relation) => relation.styleId)).toBe(true);
    expect(normalized.relations.every((relation) => relation.from in normalized.entityIndex)).toBe(true);
    expect(normalized.relations.every((relation) => relation.to in normalized.entityIndex)).toBe(true);
    expect(normalized.patchTargets.length).toBeGreaterThan(10);
  });
});
