import 'fake-indexeddb/auto';

import { createPatch } from '@ecology/authoring';

import { createEcologyStorage } from '../src/index';

describe('createEcologyStorage', () => {
  it('persists and reloads authoring patches', async () => {
    const storage = await createEcologyStorage('storage-test');
    await storage.clearAll();

    const document = { hello: { value: 1 } };
    const patch = createPatch(document, ['hello', 'value'], 2, 'Update value', 'undo-1');

    await storage.savePatch(patch);

    const patches = await storage.loadPatches();

    expect(patches).toHaveLength(1);
    expect(patches[0]?.nextValue).toBe(2);
  });
});
