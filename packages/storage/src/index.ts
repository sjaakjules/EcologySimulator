import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { AuthoringPatch } from '@ecology/authoring';

interface EcologyDb extends DBSchema {
  authoringHistory: {
    key: string;
    value: AuthoringPatch;
  };
  bundles: {
    key: string;
    value: { id: string; document: unknown; updatedAt: string };
  };
  bundleVersions: {
    key: string;
    value: { id: string; version: string; document: unknown; updatedAt: string };
  };
  scenarios: {
    key: string;
    value: { id: string; name: string; state: unknown; updatedAt: string };
  };
  snapshots: {
    key: string;
    value: { id: string; state: unknown; updatedAt: string };
  };
}

async function openEcologyDb(name: string): Promise<IDBPDatabase<EcologyDb>> {
  return openDB<EcologyDb>(name, 1, {
    upgrade(database) {
      database.createObjectStore('authoringHistory');
      database.createObjectStore('bundles');
      database.createObjectStore('bundleVersions');
      database.createObjectStore('scenarios');
      database.createObjectStore('snapshots');
    }
  });
}

export interface EcologyStorage {
  clearAll(): Promise<void>;
  getBundle(id: string): Promise<unknown | undefined>;
  loadPatches(): Promise<AuthoringPatch[]>;
  replacePatches(patches: AuthoringPatch[]): Promise<void>;
  saveBundle(id: string, document: unknown): Promise<void>;
  savePatch(patch: AuthoringPatch): Promise<void>;
  saveSnapshot(id: string, state: unknown): Promise<void>;
}

export async function createEcologyStorage(name = 'ecology-simulator'): Promise<EcologyStorage> {
  const db = await openEcologyDb(name);

  return {
    async clearAll() {
      const tx = db.transaction(
        ['authoringHistory', 'bundles', 'bundleVersions', 'scenarios', 'snapshots'],
        'readwrite'
      );

      await Promise.all([
        tx.objectStore('authoringHistory').clear(),
        tx.objectStore('bundles').clear(),
        tx.objectStore('bundleVersions').clear(),
        tx.objectStore('scenarios').clear(),
        tx.objectStore('snapshots').clear()
      ]);

      await tx.done;
    },

    async getBundle(id) {
      return (await db.get('bundles', id))?.document;
    },

    async loadPatches() {
      return db.getAll('authoringHistory');
    },

    async replacePatches(patches) {
      const tx = db.transaction('authoringHistory', 'readwrite');
      await tx.store.clear();

      for (const patch of patches) {
        await tx.store.put(patch, patch.id);
      }

      await tx.done;
    },

    async saveBundle(id, document) {
      await db.put('bundles', { id, document, updatedAt: new Date().toISOString() }, id);
    },

    async savePatch(patch) {
      await db.put('authoringHistory', patch, patch.id);
    },

    async saveSnapshot(id, state) {
      await db.put('snapshots', { id, state, updatedAt: new Date().toISOString() }, id);
    }
  };
}
