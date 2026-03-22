'use client';

import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';

import { applyPatches, createPatch, type AuthoringPatch } from '@ecology/authoring';
import { getRawMountainAshBundle } from '@ecology/content-mountain-ash';
import type { FrameSnapshot, SelectionOverlay, WorldSeedConfig, WorldViewMode } from '@ecology/domain';
import { normalizeBundle, rawContentBundleSchema, type NormalizedBundle, type RawContentBundle } from '@ecology/schema';
import { createEcologyStorage, type EcologyStorage } from '@ecology/storage';
import type { SimulationCommand, SimulationEvent } from '@ecology/worker-runtime';

import { ControlPanel, type PanelId, type PanelState, type VisualControlState } from './control-panel';
import { SceneViewport } from './scene-viewport';

const panelSideById: Record<PanelId, 'left' | 'right' | 'bottom'> = {
  ecology: 'right',
  inspector: 'right',
  simulation: 'left',
  visuals: 'bottom',
  world: 'left'
};

function buildConfig(bundle: NormalizedBundle, seed: number, viewMode: WorldViewMode): WorldSeedConfig {
  return {
    seed,
    presetId: bundle.defaultWorldPresetId,
    viewMode
  };
}

function parseRuntimeBundle(candidate: unknown, fallback: RawContentBundle) {
  try {
    const parsed = rawContentBundleSchema.parse(candidate);
    normalizeBundle(parsed);
    return parsed;
  } catch {
    return fallback;
  }
}

function setExclusivePanelState(
  current: Record<PanelId, PanelState>,
  panelId: PanelId,
  nextState: PanelState
) {
  const side = panelSideById[panelId];
  const next = { ...current };

  (Object.keys(current) as PanelId[]).forEach((candidateId) => {
    if (panelSideById[candidateId] === side) {
      next[candidateId] =
        candidateId === panelId
          ? nextState
          : {
              open: false,
              pinned: false
            };
    }
  });

  return next;
}

export function SimulatorApp() {
  const [panelStates, setPanelStates] = useState<Record<PanelId, PanelState>>({
    ecology: { open: false, pinned: false },
    inspector: { open: false, pinned: false },
    simulation: { open: false, pinned: false },
    visuals: { open: false, pinned: false },
    world: { open: false, pinned: false }
  });
  const [visuals, setVisuals] = useState<VisualControlState>({
    cameraZoom: 0.48,
    holarchyDepth: 0.48,
    lockCameraZoom: false,
    lockHolarchyDepth: false,
    pointBudgetPreset: 'balanced',
    maxPoints: 262_144,
    dofMode: 'shader',
    focusDistance: 28,
    focusLock: 'camera',
    glowMode: 'halo',
    transparencyMode: 'solid_core'
  });
  const [baseRawBundle, setBaseRawBundle] = useState<RawContentBundle>(() =>
    rawContentBundleSchema.parse(getRawMountainAshBundle())
  );
  const [workingRawBundle, setWorkingRawBundle] = useState<RawContentBundle>(() =>
    rawContentBundleSchema.parse(getRawMountainAshBundle())
  );
  const [normalizedBundle, setNormalizedBundle] = useState<NormalizedBundle>(() =>
    normalizeBundle(rawContentBundleSchema.parse(getRawMountainAshBundle()))
  );
  const [patches, setPatches] = useState<AuthoringPatch[]>([]);
  const [snapshot, setSnapshot] = useState<FrameSnapshot>();
  const [selection, setSelection] = useState<SelectionOverlay>();
  const [playing, setPlaying] = useState(false);
  const [seed, setSeed] = useState(42);
  const [viewMode, setViewMode] = useState<WorldViewMode>('tuning_standard');
  const [backendLabel, setBackendLabel] = useState('booting');
  const [status, setStatus] = useState('Loading the canonical Mountain Ash bundle.');
  const deferredSelection = useDeferredValue(selection);
  const storageRef = useRef<EcologyStorage | null>(null);
  const simWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const nextRaw = applyPatches(baseRawBundle, patches);

    startTransition(() => {
      setWorkingRawBundle(nextRaw);
      setNormalizedBundle(normalizeBundle(nextRaw));
    });
  }, [baseRawBundle, patches]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const storage = await createEcologyStorage();
      storageRef.current = storage;

      const savedBundle = await storage.getBundle('working');
      const savedPatches = await storage.loadPatches();
      const fallback = rawContentBundleSchema.parse(getRawMountainAshBundle());
      const parsedBase = savedBundle ? parseRuntimeBundle(savedBundle, fallback) : fallback;

      if (!mounted) {
        return;
      }

      setBaseRawBundle(parsedBase);
      setPatches(savedPatches);
      setStatus('Local content restored. Booting the worker runtime.');
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL('../lib/sim.worker.ts', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (event: MessageEvent<SimulationEvent>) => {
      if (event.data.type === 'FrameSnapshot' || event.data.type === 'WorldGenerated') {
        setSnapshot(event.data.snapshot);
        setStatus('Runtime synchronized with the simulation worker.');
      }

      if (event.data.type === 'SelectionOverlay') {
        setSelection(event.data.overlay);
      }

      if (event.data.type === 'Log') {
        setStatus(event.data.message);
      }
    };

    simWorkerRef.current = worker;

    return () => {
      worker.terminate();
      simWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!simWorkerRef.current) {
      return;
    }

    const command: SimulationCommand = {
      type: patches.length === 0 ? 'LoadBundle' : 'ApplyAuthoringPatch',
      bundle: normalizedBundle,
      config: buildConfig(normalizedBundle, seed, viewMode),
      ...(patches.length === 0 ? {} : { patches })
    } as SimulationCommand;

    simWorkerRef.current.postMessage(command);
  }, [normalizedBundle, patches, seed, viewMode]);

  const commitPatch = async (path: (string | number)[], nextValue: unknown, label: string) => {
    const patch = createPatch(workingRawBundle, path, nextValue, label);
    setPatches((current) => [...current, patch]);
    setStatus(`Applied authoring change: ${label}.`);

    if (storageRef.current) {
      await storageRef.current.savePatch(patch);
    }
  };

  const replaceBundle = async (nextRawBundle: RawContentBundle) => {
    setBaseRawBundle(nextRawBundle);
    setPatches([]);
    setPlaying(false);
    setSelection(undefined);
    setStatus('Imported bundle loaded. Rebuilding the runtime.');

    if (storageRef.current) {
      await storageRef.current.saveBundle('working', nextRawBundle);
      await storageRef.current.replacePatches([]);
    }
  };

  const collapseTransientPanels = () => {
    setPanelStates((current) =>
      Object.fromEntries(
        Object.entries(current).map(([panelId, state]) => [
          panelId,
          state.pinned ? state : { ...state, open: false }
        ])
      ) as Record<PanelId, PanelState>
    );
  };

  return (
    <main className="app-shell">
      <ControlPanel
        backendLabel={backendLabel}
        bundle={normalizedBundle}
        panelStates={panelStates}
        playing={playing}
        rawBundle={workingRawBundle}
        selection={deferredSelection}
        snapshot={snapshot}
        status={status}
        visuals={visuals}
        worldViewMode={viewMode}
        onAdvanceDay={() => {
          simWorkerRef.current?.postMessage({ type: 'AdvanceTicks', days: 1 } satisfies SimulationCommand);
        }}
        onChangeVisuals={(nextVisuals) => {
          setVisuals((current) => ({
            ...current,
            ...nextVisuals
          }));
        }}
        onExport={() => {
          const blob = new Blob([JSON.stringify(workingRawBundle, null, 2)], {
            type: 'application/json'
          });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'large_old_eucalypt_content_layer_v4.json';
          anchor.click();
          URL.revokeObjectURL(url);
        }}
        onImport={(file) => {
          void file.text().then(async (text) => {
            const parsed = parseRuntimeBundle(
              JSON.parse(text),
              rawContentBundleSchema.parse(getRawMountainAshBundle())
            );
            await replaceBundle(parsed);
          });
        }}
        onPatch={(path, nextValue, label) => {
          void commitPatch(path, nextValue, label);
        }}
        onPlayPause={(nextPlaying) => {
          setPlaying(nextPlaying);
          simWorkerRef.current?.postMessage({
            type: 'PlayPauseScrub',
            playing: nextPlaying
          } satisfies SimulationCommand);
        }}
        onRandomizeSeed={() => {
          const nextSeed = Math.floor(Math.random() * 10_000);
          setSeed(nextSeed);
          setStatus(
            `Regenerating the ${viewMode === 'tuning_standard' ? 'standard tuning scene' : 'hectare patch'} with seed ${nextSeed}.`
          );
        }}
        onChangeWorldMode={(nextViewMode) => {
          setViewMode(nextViewMode);
          setStatus(
            nextViewMode === 'tuning_standard'
              ? 'Switched to the compact tuning scene with one representative of each entity.'
              : 'Switched to the hectare patch comparison view.'
          );
        }}
        onTogglePanel={(panelId) => {
          setPanelStates((current) =>
            current[panelId].open
              ? {
                  ...current,
                  [panelId]: {
                    open: false,
                    pinned: false
                  }
                }
              : setExclusivePanelState(current, panelId, {
                  open: true,
                  pinned: false
                })
          );
        }}
        onTogglePanelPin={(panelId) => {
          setPanelStates((current) =>
            setExclusivePanelState(current, panelId, {
              open: true,
              pinned: !current[panelId].pinned
            })
          );
        }}
        onTriggerDisturbance={(type) => {
          simWorkerRef.current?.postMessage({
            type: 'TriggerDisturbance',
            disturbance: type,
            intensity: 0.78
          } satisfies SimulationCommand);
        }}
        onUndo={() => {
          setPatches((current) => {
            const next = current.slice(0, -1);
            if (storageRef.current) {
              void storageRef.current.replacePatches(next);
            }
            return next;
          });
        }}
      />

      <SceneViewport
        bundle={normalizedBundle}
        onBackendChange={(backend) => setBackendLabel(backend)}
        onSceneInteract={() => collapseTransientPanels()}
        onPick={(picked) => {
          if (picked) {
            setPanelStates((current) =>
              setExclusivePanelState(current, 'ecology', {
                open: true,
                pinned: current.ecology.pinned
              })
            );
          }
          simWorkerRef.current?.postMessage({
            type: 'DescribeSelection',
            selection: picked
          } satisfies SimulationCommand);
        }}
        onVisualsChange={(nextVisuals) =>
          setVisuals((current) => ({
            ...current,
            ...nextVisuals
          }))
        }
        selection={deferredSelection}
        snapshot={snapshot}
        visuals={visuals}
      />
    </main>
  );
}
