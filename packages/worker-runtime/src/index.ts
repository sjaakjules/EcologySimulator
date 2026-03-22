import type { AuthoringPatch } from '@ecology/authoring';
import type {
  CameraState,
  DisturbanceType,
  FrameSnapshot,
  SelectionOverlay,
  WorldSeedConfig
} from '@ecology/domain';
import type { NormalizedBundle } from '@ecology/schema';

export const renderPointBudgetPresets = ['preview', 'balanced', 'dense', 'million'] as const;
export type RenderPointBudgetPreset = (typeof renderPointBudgetPresets)[number];

export type RenderDofMode = 'off' | 'shader' | 'bokeh';
export type RenderFocusLock = 'camera' | 'selection';
export type RenderGlowMode = 'off' | 'halo' | 'bloom';
export type RenderTransparencyMode = 'solid_core' | 'soft_alpha';

export interface RenderVisualSettings {
  cameraZoom: number;
  holarchyDepth: number;
  pointBudgetPreset: RenderPointBudgetPreset;
  maxPoints: number;
  dofMode: RenderDofMode;
  focusDistance: number;
  focusLock: RenderFocusLock;
  glowMode: RenderGlowMode;
  transparencyMode: RenderTransparencyMode;
}

export interface RendererCapabilities {
  backend: 'webgpu' | 'webgl';
  webgl2: boolean;
  offscreenCanvas: boolean;
  aliasedPointSizeRange: [number, number];
  maxTextureSize: number;
  maxVertexTextureImageUnits: number;
  recommendedBudgetPreset: RenderPointBudgetPreset;
}

export interface RendererStats {
  backend: 'webgpu' | 'webgl' | 'main-thread';
  pointBudgetPreset: RenderPointBudgetPreset;
  maxPoints: number;
  renderedEntityPoints: number;
  renderedRelationPoints: number;
  droppedPoints: number;
  dofMode: RenderDofMode;
  glowMode: RenderGlowMode;
  transparencyMode: RenderTransparencyMode;
  postProcessingActive: boolean;
}

export type SimulationCommand =
  | { type: 'LoadBundle'; bundle: NormalizedBundle; config: WorldSeedConfig }
  | { type: 'GenerateWorld'; config: WorldSeedConfig }
  | { type: 'PlayPauseScrub'; playing: boolean; absoluteDay?: number }
  | { type: 'AdvanceTicks'; days: number }
  | {
      type: 'ApplyAuthoringPatch';
      bundle: NormalizedBundle;
      config: WorldSeedConfig;
      patches: AuthoringPatch[];
    }
  | { type: 'TriggerDisturbance'; disturbance: DisturbanceType; intensity: number }
  | { type: 'DescribeSelection'; selection?: { kind: 'anchor' | 'relation'; id: string } };

export type SimulationEvent =
  | { type: 'FrameSnapshot'; snapshot: FrameSnapshot }
  | { type: 'WorldGenerated'; snapshot: FrameSnapshot; seed: number; presetId: string }
  | { type: 'SelectionOverlay'; overlay?: SelectionOverlay }
  | { type: 'Log'; message: string };

export type RenderCommand =
  | {
      type: 'InitCanvas';
      canvas: OffscreenCanvas;
      width: number;
      height: number;
      dpr: number;
      bundle: NormalizedBundle;
    }
  | { type: 'LoadBundle'; bundle: NormalizedBundle }
  | { type: 'FrameSnapshot'; snapshot: FrameSnapshot }
  | { type: 'Resize'; width: number; height: number; dpr: number }
  | { type: 'CameraUpdate'; camera: CameraState }
  | { type: 'VisualsUpdate'; visuals: RenderVisualSettings }
  | { type: 'HoverRequest'; x: number; y: number }
  | { type: 'HoverClear' }
  | { type: 'PickRequest'; x: number; y: number }
  | { type: 'SelectionOverlay'; overlay?: SelectionOverlay }
  | { type: 'Dispose' };

export type RenderEvent =
  | { type: 'RendererReady'; backend: 'webgpu' | 'webgl'; capabilities: RendererCapabilities }
  | { type: 'RendererStats'; stats: RendererStats }
  | { type: 'HoverResult'; selection?: { kind: 'anchor' | 'relation'; id: string } }
  | { type: 'PickResult'; selection?: { kind: 'anchor' | 'relation'; id: string } }
  | { type: 'Log'; message: string };

export function transferableForSnapshot(snapshot: FrameSnapshot) {
  return [
    snapshot.positions.buffer,
    snapshot.sizes.buffer,
    snapshot.colors.buffer,
    snapshot.relationEndpoints.buffer
  ];
}
