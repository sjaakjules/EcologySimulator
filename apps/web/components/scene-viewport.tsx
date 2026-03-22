'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { EcologySceneRuntime } from '@ecology/scene3d';
import type { CameraState, FrameSnapshot, SelectionOverlay } from '@ecology/domain';
import type { NormalizedBundle } from '@ecology/schema';
import type { RenderCommand, RenderEvent, RendererCapabilities, RendererStats } from '@ecology/worker-runtime';

import type { VisualControlState } from './control-panel';

interface SceneViewportProps {
  bundle: NormalizedBundle;
  onBackendChange(backendLabel: string): void;
  onPick(selection?: { kind: 'anchor' | 'relation'; id: string }): void;
  onSceneInteract(): void;
  onVisualsChange(nextVisuals: Partial<VisualControlState>): void;
  selection?: SelectionOverlay;
  snapshot?: FrameSnapshot;
  visuals: VisualControlState;
}

type Vec3 = [number, number, number];

type DragMode = 'orbit' | 'pan';

interface DragState {
  active: boolean;
  lastX: number;
  lastY: number;
  mode: DragMode;
  moved: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
}

interface OrbitState {
  distance: number;
  target: Vec3;
}

interface HoveredItem {
  label: string;
  selection: { kind: 'anchor' | 'relation'; id: string };
  starred: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const WORLD_CENTER: Vec3 = [0, 0, 12];
const WORLD_UP: Vec3 = [0, 0, 1];
const INITIAL_POSITION: Vec3 = [44, -26, 28];
const MIN_DISTANCE = 8;
const MAX_DISTANCE = 220;
const ORBIT_SPEED = 0.006;
const PAN_SPEED = 0.0028;
const DRAG_THRESHOLD = 4;
const DEFAULT_YAW = 2.84;
const DEFAULT_PITCH = -0.5;

function distanceToZoomValue(distance: number) {
  return clamp(1 - (distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0, 1);
}

function zoomValueToDistance(value: number) {
  return MAX_DISTANCE - clamp(value, 0, 1) * (MAX_DISTANCE - MIN_DISTANCE);
}

function createInitialDragState(): DragState {
  return {
    active: false,
    lastX: 0,
    lastY: 0,
    mode: 'orbit',
    moved: false,
    pointerId: null,
    startX: 0,
    startY: 0
  };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector: Vec3, factor: number): Vec3 {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function length(vector: Vec3) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector: Vec3): Vec3 {
  const vectorLength = length(vector);

  if (vectorLength < 1e-6) {
    return [0, 0, 0];
  }

  return scale(vector, 1 / vectorLength);
}

function forwardFromAngles(yaw: number, pitch: number): Vec3 {
  return [
    Math.cos(pitch) * Math.cos(yaw),
    Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch)
  ];
}

function rightFromForward(forward: Vec3): Vec3 {
  const right = cross(forward, WORLD_UP);
  const rightLength = length(right);

  if (rightLength < 1e-6) {
    return [1, 0, 0];
  }

  return scale(right, 1 / rightLength);
}

function upFromForward(forward: Vec3, right: Vec3): Vec3 {
  return normalize(cross(right, forward));
}

function createOrbitState(position: Vec3, target: Vec3) {
  const viewVector = subtract(target, position);
  const distance = Math.max(MIN_DISTANCE, length(viewVector));
  const normalized = normalize(viewVector);

  return {
    distance,
    pitch: Math.asin(clamp(normalized[2], -0.98, 0.98)),
    target,
    yaw: Math.atan2(normalized[1], normalized[0])
  };
}

function createCameraState(target: Vec3, yaw: number, pitch: number, distance: number): CameraState {
  const forward = forwardFromAngles(yaw, pitch);
  const position = subtract(target, scale(forward, distance));

  return {
    pitch,
    position,
    yaw
  };
}

function readAnchorPosition(snapshot: FrameSnapshot, index: number): Vec3 {
  return [
    snapshot.positions[index * 3]!,
    snapshot.positions[index * 3 + 1]!,
    snapshot.positions[index * 3 + 2]!
  ];
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
}

function distanceBetween(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function boundsCenter(worldBounds: FrameSnapshot['worldBounds']): Vec3 {
  return [
    (worldBounds[0] + worldBounds[3]) * 0.5,
    (worldBounds[1] + worldBounds[4]) * 0.5,
    Math.max(0, worldBounds[2]) + (worldBounds[5] - worldBounds[2]) * 0.32
  ];
}

function boundsDistance(worldBounds: FrameSnapshot['worldBounds']) {
  const extentX = worldBounds[3] - worldBounds[0];
  const extentY = worldBounds[4] - worldBounds[1];
  const extentZ = worldBounds[5] - worldBounds[2];
  return clamp(Math.max(extentX, extentY, extentZ) * 1.45, MIN_DISTANCE + 6, MAX_DISTANCE * 0.72);
}

function resolveSelectionPivot(selection: SelectionOverlay | undefined, snapshot: FrameSnapshot | undefined) {
  if (!selection || !snapshot) {
    return undefined;
  }

  if (selection.kind === 'anchor') {
    const anchorIndex = snapshot.anchorIds.indexOf(selection.id);
    return anchorIndex >= 0 ? readAnchorPosition(snapshot, anchorIndex) : undefined;
  }

  const relationIndex = snapshot.relationIds.indexOf(selection.id);

  if (relationIndex === -1) {
    return undefined;
  }

  const start: Vec3 = [
    snapshot.relationEndpoints[relationIndex * 6]!,
    snapshot.relationEndpoints[relationIndex * 6 + 1]!,
    snapshot.relationEndpoints[relationIndex * 6 + 2]!
  ];
  const end: Vec3 = [
    snapshot.relationEndpoints[relationIndex * 6 + 3]!,
    snapshot.relationEndpoints[relationIndex * 6 + 4]!,
    snapshot.relationEndpoints[relationIndex * 6 + 5]!
  ];

  return midpoint(start, end);
}

function resolveScreenCenterPivot(snapshot: FrameSnapshot | undefined, camera: CameraState) {
  if (!snapshot || snapshot.anchorIds.length === 0) {
    return undefined;
  }

  const forward = forwardFromAngles(camera.yaw, camera.pitch);
  let bestPivot: Vec3 | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  snapshot.anchorIds.forEach((_, index) => {
    const anchor = readAnchorPosition(snapshot, index);
    const toAnchor = subtract(anchor, camera.position);
    const distance = length(toAnchor);

    if (distance < 1e-6) {
      bestPivot = anchor;
      bestScore = 0;
      return;
    }

    const alignment = dot(scale(toAnchor, 1 / distance), forward);

    if (alignment <= 0) {
      return;
    }

    const score = (1 - alignment) + distance * 0.0006;

    if (score < bestScore) {
      bestScore = score;
      bestPivot = anchor;
    }
  });

  return bestPivot;
}

function resolveHoveredItem(
  selection: { kind: 'anchor' | 'relation'; id: string } | undefined,
  snapshot: FrameSnapshot | undefined
) {
  if (!selection || !snapshot) {
    return undefined;
  }

  if (selection.kind === 'anchor') {
    const index = snapshot.anchorIds.indexOf(selection.id);
    return index === -1
      ? undefined
      : {
          label: snapshot.anchorLabels[index] ?? selection.id,
          selection,
          starred: snapshot.anchorStarred[index] ?? false
        };
  }

  const index = snapshot.relationIds.indexOf(selection.id);
  return index === -1
    ? undefined
    : {
        label: snapshot.relationLabels[index] ?? selection.id,
        selection,
        starred: snapshot.relationStarred[index] ?? false
      };
}

export function SceneViewport({
  bundle,
  onBackendChange,
  onPick,
  onSceneInteract,
  onVisualsChange,
  selection,
  snapshot,
  visuals
}: SceneViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const runtimeRef = useRef<EcologySceneRuntime | null>(null);
  const initialOrbit = createOrbitState(INITIAL_POSITION, WORLD_CENTER);
  const cameraRef = useRef<CameraState>(
    createCameraState(WORLD_CENTER, initialOrbit.yaw, initialOrbit.pitch, initialOrbit.distance)
  );
  const [hoveredItem, setHoveredItem] = useState<HoveredItem>();
  const [rendererCapabilities, setRendererCapabilities] = useState<RendererCapabilities>();
  const [rendererStats, setRendererStats] = useState<RendererStats>();
  const [rendererMessage, setRendererMessage] = useState<string>();
  const snapshotRef = useRef(snapshot);
  const visualsRef = useRef(visuals);
  const orbitRef = useRef<OrbitState>({
    distance: initialOrbit.distance,
    target: WORLD_CENTER
  });
  const selectionRef = useRef(selection);
  const bundleRef = useRef(bundle);
  const onPickRef = useRef(onPick);
  const onBackendChangeRef = useRef(onBackendChange);
  const dragState = useRef<DragState>(createInitialDragState());
  const framedKeyRef = useRef('');

  const syncCamera = (camera = cameraRef.current) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'CameraUpdate',
        camera
      } satisfies RenderCommand);
      return;
    }

    runtimeRef.current?.setCamera(camera);
  };

  const syncFocusDistance = useCallback((camera = cameraRef.current) => {
    const focusTarget =
      visualsRef.current.focusLock === 'selection'
        ? resolveSelectionPivot(selectionRef.current, snapshotRef.current) ?? orbitRef.current.target
        : orbitRef.current.target;
    const nextFocusDistance = clamp(distanceBetween(camera.position, focusTarget), 1, MAX_DISTANCE * 2);

    if (Math.abs(nextFocusDistance - visualsRef.current.focusDistance) < 0.05) {
      return;
    }

    visualsRef.current = {
      ...visualsRef.current,
      focusDistance: nextFocusDistance
    };
    onVisualsChange({ focusDistance: nextFocusDistance });
  }, [onVisualsChange]);

  useEffect(() => {
    bundleRef.current = bundle;
  }, [bundle]);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    onBackendChangeRef.current = onBackendChange;
  }, [onBackendChange]);

  useEffect(() => {
    visualsRef.current = visuals;
  }, [visuals]);

  useEffect(() => {
    snapshotRef.current = snapshot;
    setHoveredItem((current) => resolveHoveredItem(current?.selection, snapshot));
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const frameKey = `${snapshot.viewMode}:${snapshot.worldSeed}:${snapshot.worldBounds.join(':')}`;

    if (framedKeyRef.current === frameKey) {
      return;
    }

    framedKeyRef.current = frameKey;
    const nextTarget = boundsCenter(snapshot.worldBounds);
    const nextDistance = boundsDistance(snapshot.worldBounds);
    orbitRef.current.target = nextTarget;
    orbitRef.current.distance = nextDistance;
    cameraRef.current = createCameraState(nextTarget, DEFAULT_YAW, DEFAULT_PITCH, nextDistance);
    syncCamera(cameraRef.current);

    const nextZoom = distanceToZoomValue(nextDistance);
    if (Math.abs(nextZoom - visualsRef.current.cameraZoom) > 0.01) {
      visualsRef.current = {
        ...visualsRef.current,
        cameraZoom: nextZoom
      };
      onVisualsChange({ cameraZoom: nextZoom });
    }
    syncFocusDistance(cameraRef.current);
  }, [onVisualsChange, snapshot, syncFocusDistance]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const setup = async () => {
      const width = canvas.clientWidth || canvas.width || 1280;
      const height = canvas.clientHeight || canvas.height || 820;
      const dpr = window.devicePixelRatio || 1;

      if (typeof Worker !== 'undefined' && 'transferControlToOffscreen' in canvas) {
        try {
          const worker = new Worker(new URL('../lib/render.worker.ts', import.meta.url), {
            type: 'module'
          });
          const offscreen = canvas.transferControlToOffscreen();
          worker.onmessage = (event: MessageEvent<RenderEvent>) => {
            if (event.data.type === 'RendererReady') {
              setRendererCapabilities(event.data.capabilities);
              setRendererMessage(undefined);
              onBackendChangeRef.current(
                `${event.data.capabilities.webgl2 ? 'webgl2' : event.data.backend}${event.data.capabilities.offscreenCanvas ? ' worker' : ''}`
              );
              worker.postMessage({
                type: 'CameraUpdate',
                camera: cameraRef.current
              } satisfies RenderCommand);
              worker.postMessage({
                type: 'VisualsUpdate',
                visuals: visualsRef.current
              } satisfies RenderCommand);
            }

            if (event.data.type === 'RendererStats') {
              setRendererStats(event.data.stats);
            }

            if (event.data.type === 'HoverResult') {
              setHoveredItem(resolveHoveredItem(event.data.selection, snapshotRef.current));
            }

            if (event.data.type === 'PickResult') {
              onPickRef.current(event.data.selection);
            }

            if (event.data.type === 'Log') {
              setRendererMessage(event.data.message);
            }
          };
          worker.postMessage(
            {
              type: 'InitCanvas',
              canvas: offscreen,
              width,
              height,
              dpr,
              bundle: bundleRef.current
            } satisfies RenderCommand,
            [offscreen]
          );
          workerRef.current = worker;
          return;
        } catch {
          workerRef.current = null;
        }
      }

      const runtime = new EcologySceneRuntime(
        canvas,
        (nextSelection) => onPickRef.current(nextSelection),
        (capabilities) => {
          setRendererCapabilities(capabilities);
          setRendererMessage(undefined);
          onBackendChangeRef.current(`main-thread ${capabilities.webgl2 ? 'webgl2' : 'webgl1'}`);
        },
        (nextSelection) => setHoveredItem(resolveHoveredItem(nextSelection, snapshotRef.current)),
        (stats) => setRendererStats(stats),
        (message) => setRendererMessage(message),
        'main-thread'
      );

      await runtime.init(width, height, dpr);
      runtime.setBundle(bundleRef.current);
      runtimeRef.current = runtime;
      runtime.setCamera(cameraRef.current);
      runtime.setVisuals(visualsRef.current);
    };

    void setup();

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const width = canvas.clientWidth || canvas.width || 1280;
      const height = canvas.clientHeight || canvas.height || 820;
      const dpr = window.devicePixelRatio || 1;

      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'Resize',
          width,
          height,
          dpr
        } satisfies RenderCommand);
      } else {
        runtimeRef.current?.resize(width, height, dpr);
      }
    };

    onResize();
    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'LoadBundle', bundle } satisfies RenderCommand);
    } else {
      runtimeRef.current?.setBundle(bundle);
    }
  }, [bundle]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'FrameSnapshot', snapshot } satisfies RenderCommand);
    } else {
      runtimeRef.current?.setSnapshot(snapshot);
    }
  }, [snapshot]);

  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'SelectionOverlay', overlay: selection } satisfies RenderCommand);
    } else {
      runtimeRef.current?.setSelection(selection);
    }
  }, [selection]);

  useEffect(() => {
    const nextDistance = zoomValueToDistance(visuals.cameraZoom);

    if (Math.abs(nextDistance - orbitRef.current.distance) > 0.05) {
      orbitRef.current.distance = clamp(nextDistance, MIN_DISTANCE, MAX_DISTANCE);
      cameraRef.current = createCameraState(
        orbitRef.current.target,
        cameraRef.current.yaw,
        clamp(cameraRef.current.pitch, -1.35, 1.35),
        orbitRef.current.distance
      );
      syncCamera();
    }
  }, [visuals.cameraZoom]);

  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'VisualsUpdate',
        visuals
      } satisfies RenderCommand);
    } else {
      runtimeRef.current?.setVisuals(visuals);
    }
  }, [visuals]);

  useEffect(() => {
    syncFocusDistance(cameraRef.current);
  }, [selection, snapshot, visuals.focusLock, syncFocusDistance]);

  const sendPick = (x: number, y: number) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'PickRequest', x, y } satisfies RenderCommand);
    } else {
      runtimeRef.current?.pick(x, y);
    }
  };

  const sendHover = (x: number, y: number) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'HoverRequest', x, y } satisfies RenderCommand);
    } else {
      runtimeRef.current?.hover(x, y);
    }
  };

  const clearHover = () => {
    setHoveredItem(undefined);

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'HoverClear' } satisfies RenderCommand);
    } else {
      runtimeRef.current?.clearHover();
    }
  };

  const alignOrbitTarget = (nextTarget: Vec3) => {
    orbitRef.current.target = nextTarget;
    const orbit = createOrbitState(cameraRef.current.position, nextTarget);
    orbitRef.current.distance = orbit.distance;
    cameraRef.current = {
      pitch: orbit.pitch,
      position: [...cameraRef.current.position] as Vec3,
      yaw: orbit.yaw
    };
  };

  const updateOrbitCamera = (yaw: number, pitch: number, distance = orbitRef.current.distance) => {
    orbitRef.current.distance = clamp(distance, MIN_DISTANCE, MAX_DISTANCE);
    cameraRef.current = createCameraState(
      orbitRef.current.target,
      yaw,
      clamp(pitch, -1.35, 1.35),
      orbitRef.current.distance
    );
    syncCamera();
    syncFocusDistance(cameraRef.current);
  };

  return (
    <div className="viewport-shell" onPointerLeave={() => clearHover()}>
      {hoveredItem ? (
        <button
          type="button"
          className="hover-chip"
          onClick={() => onPickRef.current(hoveredItem.selection)}
        >
          <strong>{hoveredItem.label}</strong>
          {hoveredItem.starred ? ' *' : ''}
        </button>
      ) : null}
      {rendererStats ? (
        <div className="render-stats-strip">
          <span>{rendererCapabilities?.webgl2 ? 'webgl2' : rendererStats.backend}</span>
          <span>{rendererStats.renderedEntityPoints.toLocaleString()} entity pts</span>
          <span>{rendererStats.renderedRelationPoints.toLocaleString()} relation pts</span>
          <span>{rendererStats.droppedPoints.toLocaleString()} dropped</span>
          <span>{rendererStats.pointBudgetPreset}</span>
          <span>{rendererStats.dofMode}</span>
          <span>{rendererStats.glowMode}</span>
        </div>
      ) : null}
      {rendererMessage ? (
        <div className="render-status-chip" role="status">
          {rendererMessage}
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className="viewport-canvas"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          onSceneInteract();
          const mode = event.button === 2 || event.button === 1 ? 'pan' : event.button === 0 ? 'orbit' : null;

          if (!mode) {
            return;
          }

          dragState.current = {
            active: true,
            lastX: event.clientX,
            lastY: event.clientY,
            mode,
            moved: false,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragState.current.active) {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
            sendHover(x, y);
            return;
          }

          const totalDeltaX = event.clientX - dragState.current.startX;
          const totalDeltaY = event.clientY - dragState.current.startY;
          const dragDistance = Math.hypot(totalDeltaX, totalDeltaY);

          if (!dragState.current.moved && dragDistance < DRAG_THRESHOLD) {
            return;
          }

          if (!dragState.current.moved && dragState.current.mode === 'orbit') {
            const pivot =
              resolveSelectionPivot(selection, snapshot) ??
              resolveScreenCenterPivot(snapshot, cameraRef.current) ??
              orbitRef.current.target;
            alignOrbitTarget(pivot);
          }

          dragState.current.moved = true;

          const deltaX = event.clientX - dragState.current.lastX;
          const deltaY = event.clientY - dragState.current.lastY;

          if (dragState.current.mode === 'orbit') {
            updateOrbitCamera(
              cameraRef.current.yaw - deltaX * ORBIT_SPEED,
              cameraRef.current.pitch - deltaY * ORBIT_SPEED * 0.7
            );
          } else {
            const forward = forwardFromAngles(cameraRef.current.yaw, cameraRef.current.pitch);
            const right = rightFromForward(forward);
            const up = upFromForward(forward, right);
            const panScale = Math.max(0.08, orbitRef.current.distance * PAN_SPEED);
            const translation = add(scale(right, -deltaX * panScale), scale(up, deltaY * panScale));

            orbitRef.current.target = add(orbitRef.current.target, translation);
            cameraRef.current = {
              ...cameraRef.current,
              position: add(cameraRef.current.position, translation)
            };
            syncCamera();
            syncFocusDistance(cameraRef.current);
          }

          dragState.current.lastX = event.clientX;
          dragState.current.lastY = event.clientY;
        }}
        onPointerUp={(event) => {
          const didMove = dragState.current.moved;
          const wasOrbitClick = dragState.current.mode === 'orbit' && !didMove && event.button === 0;

          dragState.current = createInitialDragState();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }

          if (wasOrbitClick) {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
            sendPick(x, y);
          }
        }}
        onPointerCancel={(event) => {
          dragState.current = createInitialDragState();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          const wheelDelta = -Math.sign(event.deltaY || 1) * 0.05;
          const nextVisuals: Partial<VisualControlState> = {};

          if (!visualsRef.current.lockCameraZoom) {
            const nextCameraZoom = clamp(distanceToZoomValue(orbitRef.current.distance) + wheelDelta, 0, 1);
            nextVisuals.cameraZoom = nextCameraZoom;
            updateOrbitCamera(
              cameraRef.current.yaw,
              cameraRef.current.pitch,
              zoomValueToDistance(nextCameraZoom)
            );
          }

          if (!visualsRef.current.lockHolarchyDepth) {
            nextVisuals.holarchyDepth = clamp(visualsRef.current.holarchyDepth + wheelDelta, 0, 1);
          }

          if (Object.keys(nextVisuals).length > 0) {
            visualsRef.current = {
              ...visualsRef.current,
              ...nextVisuals
            };
            if (visualsRef.current.focusLock === 'camera' || visualsRef.current.focusLock === 'selection') {
              const focusTarget =
                visualsRef.current.focusLock === 'selection'
                  ? resolveSelectionPivot(selectionRef.current, snapshotRef.current) ?? orbitRef.current.target
                  : orbitRef.current.target;
              nextVisuals.focusDistance = clamp(distanceBetween(cameraRef.current.position, focusTarget), 1, MAX_DISTANCE * 2);
              visualsRef.current.focusDistance = nextVisuals.focusDistance;
            }
            onVisualsChange(nextVisuals);
          }
        }}
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
