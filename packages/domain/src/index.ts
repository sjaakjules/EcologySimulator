export const organisationCheckpointIds = [
  'micro',
  'macro',
  'part',
  'organism',
  'colony',
  'community',
  'landscape',
  'systemic'
] as const;

export type OrganisationCheckpointId = (typeof organisationCheckpointIds)[number];

export const organisationCheckpointOrder = new Map<OrganisationCheckpointId, number>(
  organisationCheckpointIds.map((checkpoint, index) => [checkpoint, index])
);

export const organisationCheckpointValues: Record<OrganisationCheckpointId, number> = {
  micro: 0.06,
  macro: 0.16,
  part: 0.29,
  organism: 0.44,
  colony: 0.57,
  community: 0.7,
  landscape: 0.84,
  systemic: 0.95
};

export interface OrganisationScale {
  checkpointId: OrganisationCheckpointId;
  position01: number;
  visiblePlusMinus01: number;
  visibleRange01: [number, number];
}

export interface OrganisationCheckpoint {
  id: OrganisationCheckpointId;
  label: string;
  value01: number;
  description?: string;
  examples: string[];
  sourceIds: string[];
}

export interface KindCatalogEntry {
  id: string;
  label: string;
  branch: string;
  description?: string;
  organisationBounds01?: [number, number];
  defaultCheckpointId: OrganisationCheckpointId;
  legacyKindAliases: string[];
  typicalChildKindIds: string[];
  typicalParentKindIds: string[];
  primaryNestingLinkType?: string;
  exampleEntityIds: string[];
  sourceIds: string[];
  currentEntityCount: number;
}

export interface NestedEntityLink {
  id: string;
  parent: string;
  child: string;
  linkType: string;
  tier?: string;
  description?: string;
  sourceIds: string[];
}

export const relationTrailStyleIds = [
  'resource_flow',
  'signal_plume',
  'occupancy_tether',
  'predation_arc',
  'mycelial_diffuse_star',
  'fire_front'
] as const;

export type RelationTrailStyleId = (typeof relationTrailStyleIds)[number];

export type RelationPathShape =
  | 'straight'
  | 'bezier'
  | 'spline'
  | 'advected-field'
  | 'branching-diffuse'
  | 'front';

export type RelationMotionProfile =
  | 'pulse'
  | 'continuous-flow'
  | 'diffuse'
  | 'intermittent'
  | 'burst'
  | 'front-propagation';

export type AnchorMode =
  | 'centroid'
  | 'surface-random'
  | 'cavity-rim'
  | 'bark-fissure'
  | 'canopy-shell'
  | 'root-disk'
  | 'log-face'
  | 'ground-patch';

export interface RelationTrailStyle {
  id: RelationTrailStyleId;
  pathShape: RelationPathShape;
  motionProfile: RelationMotionProfile;
  spawnAnchorMode: AnchorMode;
  targetAnchorMode: AnchorMode;
  turbulence: number;
  linearity: number;
  particleDensity: number;
  speed: number;
  arrivalBehavior: 'fade' | 'merge' | 'snap' | 'impact' | 'persistent-glow';
  color: string;
}

export const relationTrailStyles: Record<RelationTrailStyleId, RelationTrailStyle> = {
  resource_flow: {
    id: 'resource_flow',
    pathShape: 'bezier',
    motionProfile: 'continuous-flow',
    spawnAnchorMode: 'root-disk',
    targetAnchorMode: 'ground-patch',
    turbulence: 0.2,
    linearity: 0.75,
    particleDensity: 18,
    speed: 0.75,
    arrivalBehavior: 'merge',
    color: '#d8f59d'
  },
  signal_plume: {
    id: 'signal_plume',
    pathShape: 'advected-field',
    motionProfile: 'diffuse',
    spawnAnchorMode: 'canopy-shell',
    targetAnchorMode: 'surface-random',
    turbulence: 0.75,
    linearity: 0.25,
    particleDensity: 22,
    speed: 0.45,
    arrivalBehavior: 'fade',
    color: '#8de2ff'
  },
  occupancy_tether: {
    id: 'occupancy_tether',
    pathShape: 'spline',
    motionProfile: 'intermittent',
    spawnAnchorMode: 'cavity-rim',
    targetAnchorMode: 'centroid',
    turbulence: 0.35,
    linearity: 0.5,
    particleDensity: 12,
    speed: 0.55,
    arrivalBehavior: 'snap',
    color: '#ffd479'
  },
  predation_arc: {
    id: 'predation_arc',
    pathShape: 'spline',
    motionProfile: 'burst',
    spawnAnchorMode: 'centroid',
    targetAnchorMode: 'centroid',
    turbulence: 0.1,
    linearity: 0.92,
    particleDensity: 9,
    speed: 1.15,
    arrivalBehavior: 'impact',
    color: '#ff8f6b'
  },
  mycelial_diffuse_star: {
    id: 'mycelial_diffuse_star',
    pathShape: 'branching-diffuse',
    motionProfile: 'pulse',
    spawnAnchorMode: 'log-face',
    targetAnchorMode: 'ground-patch',
    turbulence: 0.7,
    linearity: 0.22,
    particleDensity: 20,
    speed: 0.28,
    arrivalBehavior: 'persistent-glow',
    color: '#a9efc4'
  },
  fire_front: {
    id: 'fire_front',
    pathShape: 'front',
    motionProfile: 'front-propagation',
    spawnAnchorMode: 'ground-patch',
    targetAnchorMode: 'ground-patch',
    turbulence: 0.4,
    linearity: 0.88,
    particleDensity: 24,
    speed: 1.35,
    arrivalBehavior: 'impact',
    color: '#ffbf66'
  }
};

export type DisturbanceType = 'wildfire' | 'drought' | 'logging' | 'parameter_shock';

export type WorldViewMode = 'tuning_standard' | 'hectare_patch';

export type AnchorRenderClass = 'physical_wireframe' | 'bounded_translucent' | 'diffuse_overlay';

export interface SurfaceAnchor {
  id: string;
  mode: AnchorMode;
  position: [number, number, number];
}

export interface SpatialAnchor {
  id: string;
  entityType: string;
  label: string;
  kind: string;
  position: [number, number, number];
  rotation?: [number, number, number, number];
  boundsAabb: [number, number, number, number, number, number];
  fixedInWorld: boolean;
  occupancyVoxels: number[];
  surfaceAnchors?: SurfaceAnchor[];
  starred: boolean;
  evidenceTier?: string;
  renderClass: AnchorRenderClass;
  organisationScale: OrganisationScale;
  legacyScale?: string;
  hostAnchorId?: string | null;
  nestedParentAnchorId?: string | null;
}

export interface GeneratedRelationCorridor {
  id: string;
  label: string;
  sourceAnchorId: string;
  targetAnchorId: string;
  styleId: RelationTrailStyleId;
  type: string;
  starred: boolean;
  supportSign?: string;
}

export interface WorldSeedConfig {
  seed: number;
  presetId: string;
  viewMode: WorldViewMode;
  generationOverrides?: Record<string, number>;
  scenarioToggles?: Partial<Record<DisturbanceType, boolean>>;
}

export interface SelectionOverlay {
  id: string;
  kind: 'anchor' | 'relation';
  label: string;
  starred: boolean;
  subtitle?: string;
  details?: Record<string, string | number | boolean>;
}

export interface SimulationMetrics {
  currentDay: number;
  phase: 'growth' | 'conservation' | 'release' | 'reorganization';
  moisture: number;
  disturbancePressure: number;
  fixedAnchorCount: number;
  mobileAnchorCount: number;
}

export interface FrameSnapshot {
  revision: number;
  worldSeed: number;
  viewMode: WorldViewMode;
  anchorIds: string[];
  anchorEntityTypes: string[];
  anchorLabels: string[];
  anchorKinds: string[];
  anchorStarred: boolean[];
  anchorFixed: boolean[];
  anchorRenderClasses: AnchorRenderClass[];
  anchorOrganisationPositions: number[];
  anchorOrganisationCheckpoints: OrganisationCheckpointId[];
  anchorLegacyScales: string[];
  anchorHostAnchorIds: (string | null)[];
  anchorNestedParentAnchorIds: (string | null)[];
  positions: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  relationEndpoints: Float32Array;
  relationIds: string[];
  relationLabels: string[];
  relationStyleIds: RelationTrailStyleId[];
  relationStarred: boolean[];
  relationSourceAnchorIds: string[];
  relationTargetAnchorIds: string[];
  worldBounds: [number, number, number, number, number, number];
  metrics: SimulationMetrics;
}

export interface CameraState {
  position: [number, number, number];
  yaw: number;
  pitch: number;
}

export interface PatchTarget {
  path: (string | number)[];
  label: string;
  kind: 'number' | 'string' | 'enum';
  source: 'entity' | 'relation' | 'world';
  options?: string[];
}
