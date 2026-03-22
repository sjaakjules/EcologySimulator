import type { AuthoringPatch } from '@ecology/authoring';
import type {
  CameraState,
  DisturbanceType,
  FrameSnapshot,
  SelectionOverlay,
  WorldSeedConfig
} from '@ecology/domain';
import type { NormalizedBundle } from '@ecology/schema';

export interface RenderVisualSettings {
  holarchyDepth: number;
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
  | { type: 'RendererReady'; backend: 'webgpu' | 'webgl' }
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
