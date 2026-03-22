import {
  organisationCheckpointOrder,
  relationTrailStyles,
  type AnchorRenderClass,
  type DisturbanceType,
  type FrameSnapshot,
  type GeneratedRelationCorridor,
  type OrganisationCheckpointId,
  type SelectionOverlay,
  type SimulationMetrics,
  type SpatialAnchor,
  type SurfaceAnchor,
  type WorldSeedConfig
} from '@ecology/domain';
import type { NormalizedBundle, NormalizedEntity, NormalizedRelation } from '@ecology/schema';

export interface SparseOctreeChunk {
  id: number;
  level: number;
  voxelSize: number;
  boundsAabb: [number, number, number, number, number, number];
  anchorIds: string[];
  childIds: number[];
}

export interface GeneratedWorld {
  seed: number;
  presetId: string;
  viewMode: WorldSeedConfig['viewMode'];
  anchors: SpatialAnchor[];
  anchorIndex: Record<string, SpatialAnchor>;
  entityTypeIndex: Record<string, string[]>;
  relationCorridors: GeneratedRelationCorridor[];
  chunks: SparseOctreeChunk[];
  worldBounds: [number, number, number, number, number, number];
}

type TickPhase = 'growth' | 'conservation' | 'release' | 'reorganization';
type Vec3 = [number, number, number];

const checkpointToSize: Record<OrganisationCheckpointId, [number, number, number]> = {
  micro: [0.35, 0.35, 0.2],
  macro: [1.2, 1.2, 0.5],
  part: [1.8, 1.8, 2.6],
  organism: [3.2, 3.2, 10],
  colony: [4.6, 4.6, 4.4],
  community: [8.5, 8.5, 5.5],
  landscape: [16, 16, 8],
  systemic: [22, 22, 12]
};

const kindToColorFamily: Record<string, { hue: number; saturation: number; lightness: number }> = {
  anthropogenic_field: { hue: 18, saturation: 0.46, lightness: 0.46 },
  cohort: { hue: 90, saturation: 0.3, lightness: 0.48 },
  colony: { hue: 148, saturation: 0.34, lightness: 0.46 },
  community: { hue: 126, saturation: 0.28, lightness: 0.44 },
  environmental_field: { hue: 186, saturation: 0.34, lightness: 0.52 },
  event: { hue: 10, saturation: 0.66, lightness: 0.5 },
  guild: { hue: 110, saturation: 0.26, lightness: 0.44 },
  memory_field: { hue: 224, saturation: 0.24, lightness: 0.52 },
  organism: { hue: 104, saturation: 0.3, lightness: 0.4 },
  organism_association: { hue: 74, saturation: 0.28, lightness: 0.46 },
  place_patch: { hue: 164, saturation: 0.22, lightness: 0.46 },
  population: { hue: 196, saturation: 0.34, lightness: 0.48 },
  process_network: { hue: 160, saturation: 0.24, lightness: 0.54 },
  regime: { hue: 8, saturation: 0.5, lightness: 0.5 },
  structural_field: { hue: 146, saturation: 0.22, lightness: 0.48 },
  structural_locale: { hue: 36, saturation: 0.26, lightness: 0.46 },
  structure: { hue: 34, saturation: 0.2, lightness: 0.44 },
  substrate: { hue: 28, saturation: 0.26, lightness: 0.4 }
};

const diffuseKinds = new Set([
  'anthropogenic_field',
  'environmental_field',
  'event',
  'memory_field',
  'process_network',
  'regime',
  'structural_field'
]);

const boundedKinds = new Set(['cohort', 'colony', 'community', 'guild', 'place_patch', 'population']);

const tuningAbsolutePositions: Record<string, Vec3> = {
  LargeOldEucalyptTree: [0, 0, 0],
  StandingDeadTree: [14, 4, 0],
  FallenLog: [16, -5, 0],
  TreeFernGuild: [-11, -7, 0],
  RainforestUnderstoryGuild: [-13, -13, 0],
  WattleGuild: [10, -11, 0],
  MountainAshRecruitmentCohort: [8, -7, 0],
  CoarseWoodyBranchMat: [10, -3, 0],
  OldGrowthPatch: [0, 0, 0],
  CanopyGapField: [8, -9, 0],
  StandStructuralComplexityField: [0, 0, 0],
  LandscapeMemoryField: [0, 0, 8],
  FogMoistureField: [-10, -10, 2],
  SunlightField: [0, 0, 16],
  LoggingMatrixField: [22, 6, 0],
  DroughtRegime: [0, 0, 18],
  FireEvent: [19, 12, 2],
  SalvageLoggingOperation: [21, 15, 1]
};

const nestedAttachmentOrder: Record<string, { radius: number; angle: number; zBias: number }> = {
  CrownCanopyModule: { radius: 2.2, angle: 0.2, zBias: 0.82 },
  RootMat: { radius: 0.8, angle: 2.6, zBias: 0.02 },
  ButtressMicrohabitat: { radius: 1.6, angle: 2.1, zBias: 0.04 },
  BarkStreamerPatch: { radius: 1.4, angle: -0.4, zBias: 0.46 },
  HollowCavity: { radius: 1.2, angle: 0.5, zBias: 0.38 },
  FireScarPatch: { radius: 1.1, angle: -1.1, zBias: 0.22 },
  MistletoeClump: { radius: 2.4, angle: -0.8, zBias: 0.8 },
  DawsoniaSuperbaPatch: { radius: 1.1, angle: 0.4, zBias: 0.86 },
  BryophyteLichenGuild: { radius: 0.7, angle: -0.6, zBias: 0.84 },
  WoodDecayFungiGuild: { radius: 0.9, angle: 0.9, zBias: 0.72 },
  EpiphyticPlantGuild: { radius: 1.1, angle: 0.8, zBias: 0.9 }
};

const relationHostPreference = [
  'access_filter',
  'habitat_provision',
  'host_substrate',
  'microhabitat_support',
  'refugia_provision',
  'food_provision',
  'feature_formation',
  'part_formation',
  'substrate_provision',
  'resource_modulation',
  'facilitation'
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function hueToRgb(p: number, q: number, t: number) {
  let wrapped = t;

  if (wrapped < 0) {
    wrapped += 1;
  }

  if (wrapped > 1) {
    wrapped -= 1;
  }

  if (wrapped < 1 / 6) {
    return p + (q - p) * 6 * wrapped;
  }

  if (wrapped < 1 / 2) {
    return q;
  }

  if (wrapped < 2 / 3) {
    return p + (q - p) * (2 / 3 - wrapped) * 6;
  }

  return p;
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const normalizedHue = ((hue % 360) + 360) % 360 / 360;

  if (saturation <= 0) {
    return [lightness, lightness, lightness];
  }

  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return [
    hueToRgb(p, q, normalizedHue + 1 / 3),
    hueToRgb(p, q, normalizedHue),
    hueToRgb(p, q, normalizedHue - 1 / 3)
  ];
}

function deriveRenderClass(entity: NormalizedEntity): AnchorRenderClass {
  if (diffuseKinds.has(entity.kind)) {
    return 'diffuse_overlay';
  }

  if (boundedKinds.has(entity.kind)) {
    return 'bounded_translucent';
  }

  return 'physical_wireframe';
}

function deriveAnchorBaseColor(anchor: SpatialAnchor): [number, number, number] {
  const family = kindToColorFamily[anchor.kind] ?? {
    hue: 34,
    saturation: 0.24,
    lightness: 0.46
  };
  const hash = hashString(anchor.entityType);
  const scaleBias = (anchor.organisationScale.position01 - 0.5) * 0.08;
  const hueShift = (hash % 37) - 18;
  const saturationShift = (((hash >>> 6) % 11) - 5) * 0.012;
  const lightnessShift = (((hash >>> 12) % 11) - 5) * 0.013 + scaleBias;

  return hslToRgb(
    family.hue + hueShift,
    clamp(family.saturation + saturationShift, 0.12, 0.82),
    clamp(family.lightness + lightnessShift, 0.22, 0.74)
  );
}

function mulberry32(seed: number) {
  let t = seed >>> 0;

  return function next() {
    t += 0x6d2b79f5;
    let value = Math.imul(t ^ (t >>> 15), 1 | t);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInRange(next: () => number, min: number, max: number) {
  return min + (max - min) * next();
}

function makeQuaternion(): [number, number, number, number] {
  return [0, 0, 0, 1];
}

function isMobileEntity(entity: NormalizedEntity): boolean {
  return entity.kind === 'population' || entity.kind === 'colony';
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function polarPosition(center: Vec3, radius: number, angle: number, z = 0): Vec3 {
  return [
    center[0] + Math.cos(angle) * radius,
    center[1] + Math.sin(angle) * radius,
    z
  ];
}

function deriveEntitySize(
  entity: NormalizedEntity,
  renderClass: AnchorRenderClass,
  overrides: Record<string, { default?: string | number | boolean | null }> = {}
): [number, number, number] {
  const fallback = checkpointToSize[entity.organisationScale.checkpointId];
  const numericOverride = (key: string) => {
    const value = overrides[key]?.default ?? entity.parameters[key]?.default;
    return typeof value === 'number' ? value : undefined;
  };

  switch (entity.id) {
    case 'LargeOldEucalyptTree':
      return [
        numericOverride('approx_dbh_m') ?? 3.1,
        numericOverride('approx_dbh_m') ?? 3.1,
        numericOverride('approx_height_m') ?? 68
      ];
    case 'StandingDeadTree':
      return [1.8, 1.8, 38];
    case 'FallenLog':
      return [10.5, 1.6, 1.2];
    case 'TreeFernGuild':
      return [2.8, 2.8, 6.4];
    case 'RainforestUnderstoryGuild':
      return [6.4, 6.4, 2.8];
    case 'WattleGuild':
      return [5.4, 5.4, 5.8];
    case 'BryophyteLichenGuild':
      return [2.4, 2.4, 0.55];
    case 'MountainAshRecruitmentCohort':
      return [6.8, 6.8, 4.6];
    case 'HollowCavity':
      return [1.3, 1.1, 3.2];
    case 'CrownCanopyModule':
      return [12, 12, 9];
    case 'RootMat':
      return [8, 8, 1.4];
    case 'ButtressMicrohabitat':
      return [3.4, 2.8, 4.2];
    case 'BarkStreamerPatch':
      return [1.1, 0.8, 6.2];
    case 'FireScarPatch':
      return [1.4, 0.7, 4.6];
    case 'MistletoeClump':
      return [2.4, 2.4, 2.4];
    case 'CoarseWoodyBranchMat':
      return [4.8, 2.8, 1.2];
    case 'CanopyGapField':
      return [10.5, 10.5, 7];
    case 'OldGrowthPatch':
      return [30, 30, 9];
    case 'StandStructuralComplexityField':
      return [24, 24, 12];
    case 'LandscapeMemoryField':
      return [38, 38, 16];
    case 'FogMoistureField':
      return [22, 18, 10];
    case 'SunlightField':
      return [34, 34, 14];
    case 'LoggingMatrixField':
      return [18, 20, 8];
    case 'DroughtRegime':
      return [36, 36, 14];
    case 'FireEvent':
      return [16, 16, 10];
    case 'SalvageLoggingOperation':
      return [12, 12, 8];
    case 'MycorrhizalExchangeNetworkStar':
      return [14, 14, 4];
    default:
      if (renderClass === 'diffuse_overlay') {
        return [fallback[0] * 1.35, fallback[1] * 1.35, Math.max(fallback[2], 6)];
      }

      if (renderClass === 'bounded_translucent') {
        return [fallback[0], fallback[1], Math.max(fallback[2] * 0.92, 1.2)];
      }

      return fallback;
  }
}

function createBounds(position: Vec3, size: [number, number, number]) {
  const [x, y, z] = position;
  const [width, depth, height] = size;

  return [
    x - width / 2,
    y - depth / 2,
    z,
    x + width / 2,
    y + depth / 2,
    z + height
  ] as [number, number, number, number, number, number];
}

function createSurfaceAnchors(anchor: SpatialAnchor, size: [number, number, number]): SurfaceAnchor[] {
  const [x, y, z] = anchor.position;
  const [, , height] = size;

  if (anchor.renderClass === 'diffuse_overlay') {
    return [
      { id: `${anchor.id}:centroid`, mode: 'centroid', position: [x, y, z + height * 0.5] },
      { id: `${anchor.id}:ground`, mode: 'ground-patch', position: [x, y, z + 0.2] }
    ];
  }

  if (anchor.entityType === 'HollowCavity') {
    return [
      { id: `${anchor.id}:rim`, mode: 'cavity-rim', position: [x, y, z + height * 0.58] },
      { id: `${anchor.id}:body`, mode: 'surface-random', position: [x, y, z + height * 0.42] }
    ];
  }

  if (anchor.entityType === 'FallenLog') {
    return [
      { id: `${anchor.id}:base`, mode: 'ground-patch', position: [x, y, z + 0.1] },
      { id: `${anchor.id}:face`, mode: 'log-face', position: [x, y, z + height * 0.7] }
    ];
  }

  if (anchor.entityType === 'BarkStreamerPatch') {
    return [
      { id: `${anchor.id}:fissure`, mode: 'bark-fissure', position: [x, y, z + height * 0.5] }
    ];
  }

  return [
    { id: `${anchor.id}:base`, mode: 'root-disk', position: [x, y, z] },
    { id: `${anchor.id}:mid`, mode: 'surface-random', position: [x, y, z + height * 0.45] },
    { id: `${anchor.id}:canopy`, mode: 'canopy-shell', position: [x, y, z + height * 0.9] }
  ];
}

function createAnchor(
  entity: NormalizedEntity,
  instanceId: string,
  position: Vec3,
  overrides: Record<string, { default?: string | number | boolean | null }> = {},
  context: {
    hostAnchorId?: string | null;
    nestedParentAnchorId?: string | null;
  } = {}
): SpatialAnchor {
  const renderClass = deriveRenderClass(entity);
  const size = deriveEntitySize(entity, renderClass, overrides);
  const mobile = isMobileEntity(entity);

  const anchor: SpatialAnchor = {
    id: instanceId,
    entityType: entity.id,
    label: entity.displayLabel,
    kind: entity.kind,
    position,
    rotation: makeQuaternion(),
    boundsAabb: createBounds(position, size),
    fixedInWorld: !mobile,
    occupancyVoxels: [],
    surfaceAnchors: undefined,
    starred: entity.starred,
    renderClass,
    organisationScale: entity.organisationScale,
    legacyScale: entity.legacyScale,
    hostAnchorId: context.hostAnchorId ?? null,
    nestedParentAnchorId: context.nestedParentAnchorId ?? null
  };

  if (!mobile) {
    anchor.surfaceAnchors = createSurfaceAnchors(anchor, size);
  }

  return anchor;
}

function samplePatternPosition(
  pattern: string,
  index: number,
  next: () => number,
  extent: { x: number; y: number; z: number },
  heroPosition: Vec3
): Vec3 {
  const angle = ((index + 1) / 7 + next()) * Math.PI * 2;

  switch (pattern) {
    case 'clustered_multiaged':
      return polarPosition(heroPosition, randomInRange(next, 9, 35), angle);
    case 'legacy_scatter_near_old_trees':
      return polarPosition(heroPosition, randomInRange(next, 10, 42), angle + 0.4);
    case 'downslope_and_random_fall_vectors':
      return [
        randomInRange(next, 8, extent.x - 8),
        clamp(randomInRange(next, 6, extent.y - 6) + index * 0.45, 6, extent.y - 6),
        0
      ];
    case 'gully_biased_clusters':
      return [randomInRange(next, 12, extent.x - 12), randomInRange(next, 10, extent.y * 0.34), 0];
    case 'gully_and_shaded_sector_clumps':
      return [
        randomInRange(next, extent.x * 0.4, extent.x * 0.88),
        randomInRange(next, 12, extent.y * 0.42),
        0
      ];
    case 'gap_and_edge_clusters':
      return [
        next() > 0.5 ? randomInRange(next, 5, 18) : randomInRange(next, extent.x - 18, extent.x - 5),
        randomInRange(next, extent.y * 0.25, extent.y * 0.8),
        0
      ];
    case 'substrate_attached':
      return polarPosition(heroPosition, randomInRange(next, 2.5, 22), angle + 0.8);
    case 'gap_biased_patch':
      return [randomInRange(next, extent.x * 0.3, extent.x * 0.6), randomInRange(next, extent.y * 0.55, extent.y * 0.85), 0];
    default:
      return [randomInRange(next, 5, extent.x - 5), randomInRange(next, 5, extent.y - 5), 0];
  }
}

function chooseHectareFallbackPosition(
  entity: NormalizedEntity,
  next: () => number,
  extent: { x: number; y: number; z: number },
  heroPosition: Vec3
): Vec3 {
  const renderClass = deriveRenderClass(entity);

  if (isMobileEntity(entity)) {
    return [
      heroPosition[0] + randomInRange(next, -16, 16),
      heroPosition[1] + randomInRange(next, -16, 16),
      entity.id.includes('Owl') ? 18 : entity.id.includes('Glider') ? 12 : 1
    ];
  }

  if (entity.organisationScale.position01 <= 0.35) {
    return [
      heroPosition[0] + randomInRange(next, -4, 4),
      heroPosition[1] + randomInRange(next, -4, 4),
      randomInRange(next, 0.2, 12)
    ];
  }

  if (renderClass === 'diffuse_overlay') {
    return [
      heroPosition[0] + randomInRange(next, -10, 10),
      heroPosition[1] + randomInRange(next, -10, 10),
      randomInRange(next, 3, 12)
    ];
  }

  return [
    randomInRange(next, 8, extent.x - 8),
    randomInRange(next, 8, extent.y - 8),
    entity.organisationScale.position01 > 0.8 ? 8 : 0
  ];
}

function anchorSize(anchor: SpatialAnchor): [number, number, number] {
  return [
    anchor.boundsAabb[3] - anchor.boundsAabb[0],
    anchor.boundsAabb[4] - anchor.boundsAabb[1],
    anchor.boundsAabb[5] - anchor.boundsAabb[2]
  ];
}

function computeWorldBounds(anchors: SpatialAnchor[], margin = 6): GeneratedWorld['worldBounds'] {
  if (anchors.length === 0) {
    return [-10, -10, 0, 10, 10, 20];
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  anchors.forEach((anchor) => {
    minX = Math.min(minX, anchor.boundsAabb[0]);
    minY = Math.min(minY, anchor.boundsAabb[1]);
    minZ = Math.min(minZ, anchor.boundsAabb[2]);
    maxX = Math.max(maxX, anchor.boundsAabb[3]);
    maxY = Math.max(maxY, anchor.boundsAabb[4]);
    maxZ = Math.max(maxZ, anchor.boundsAabb[5]);
  });

  return [
    minX - margin,
    minY - margin,
    Math.min(0, minZ - 1),
    maxX + margin,
    maxY + margin,
    maxZ + margin
  ];
}

function attachVoxelsToAnchors(anchors: SpatialAnchor[], chunks: SparseOctreeChunk[]) {
  const leafByAnchor = new Map<string, number[]>();

  chunks.forEach((chunk) => {
    if (chunk.childIds.length === 0) {
      chunk.anchorIds.forEach((anchorId) => {
        const existing = leafByAnchor.get(anchorId) ?? [];
        existing.push(chunk.id);
        leafByAnchor.set(anchorId, existing);
      });
    }
  });

  anchors.forEach((anchor) => {
    anchor.occupancyVoxels = leafByAnchor.get(anchor.id) ?? [];
  });
}

function buildSparseOctree(
  anchors: SpatialAnchor[],
  worldBounds: [number, number, number, number, number, number],
  voxelSizeLadder: number[]
): SparseOctreeChunk[] {
  const chunks: SparseOctreeChunk[] = [];
  const [minX, minY, minZ, maxX, maxY, maxZ] = worldBounds;
  const maxExtent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  const rootSize = 2 ** Math.ceil(Math.log2(Math.max(1, maxExtent)));
  const maxDepth = Math.min(6, Math.max(2, voxelSizeLadder.length - 1));

  function insert(anchorSubset: SpatialAnchor[], bounds: SparseOctreeChunk['boundsAabb'], level: number): number {
    const voxelSize = rootSize / 2 ** level;
    const chunkId = chunks.length;
    const chunk: SparseOctreeChunk = {
      id: chunkId,
      level,
      voxelSize,
      boundsAabb: bounds,
      anchorIds: anchorSubset.map((anchor) => anchor.id),
      childIds: []
    };

    chunks.push(chunk);

    if (anchorSubset.length <= 6 || level >= maxDepth || voxelSize <= voxelSizeLadder[2]) {
      return chunkId;
    }

    const [x0, y0, z0, x1, y1, z1] = bounds;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const mz = (z0 + z1) / 2;

    const octants = [
      [x0, y0, z0, mx, my, mz],
      [mx, y0, z0, x1, my, mz],
      [x0, my, z0, mx, y1, mz],
      [mx, my, z0, x1, y1, mz],
      [x0, y0, mz, mx, my, z1],
      [mx, y0, mz, x1, my, z1],
      [x0, my, mz, mx, y1, z1],
      [mx, my, mz, x1, y1, z1]
    ] as SparseOctreeChunk['boundsAabb'][];

    octants.forEach((octantBounds) => {
      const subset = anchorSubset.filter((anchor) => {
        const [ax, ay, az] = anchor.position;
        return (
          ax >= octantBounds[0] &&
          ax <= octantBounds[3] &&
          ay >= octantBounds[1] &&
          ay <= octantBounds[4] &&
          az >= octantBounds[2] &&
          az <= octantBounds[5]
        );
      });

      if (subset.length > 0) {
        chunk.childIds.push(insert(subset, octantBounds, level + 1));
      }
    });

    return chunkId;
  }

  insert(anchors, [minX, minY, minZ, minX + rootSize, minY + rootSize, minZ + rootSize], 0);
  attachVoxelsToAnchors(anchors, chunks);
  return chunks;
}

function buildRelationCorridors(
  relations: NormalizedRelation[],
  entityTypeIndex: Record<string, string[]>
): GeneratedRelationCorridor[] {
  return relations.flatMap((relation, index) => {
    const sourceAnchors = entityTypeIndex[relation.from] ?? [];
    const targetAnchors = entityTypeIndex[relation.to] ?? [];

    if (sourceAnchors.length === 0 || targetAnchors.length === 0) {
      return [];
    }

    const sourceAnchorId = sourceAnchors[index % sourceAnchors.length]!;
    const targetAnchorId = targetAnchors[(index * 3) % targetAnchors.length]!;

    return [
      {
        id: relation.id,
        label: relation.description ?? relation.id,
        sourceAnchorId,
        targetAnchorId,
        styleId: relation.styleId,
        type: relation.type,
        starred: relation.starred,
        supportSign: relation.supportSign
      }
    ];
  });
}

function tuningHostFallbackPosition(entity: NormalizedEntity, heroPosition: Vec3, next: () => number): Vec3 {
  const radius = 8 + entity.organisationScale.position01 * 12;
  const angle = hashString(entity.id) * 0.0002 + next() * Math.PI * 0.2;
  const base = polarPosition(heroPosition, radius, angle);
  const z =
    deriveRenderClass(entity) === 'diffuse_overlay'
      ? 4 + entity.organisationScale.position01 * 8
      : isMobileEntity(entity)
        ? entity.id.includes('Owl')
          ? 12
          : 1.5
        : 0;

  return [base[0], base[1], z];
}

function positionRelativeToHost(
  entity: NormalizedEntity,
  hostAnchor: SpatialAnchor,
  next: () => number
): Vec3 {
  const hostSize = anchorSize(hostAnchor);
  const attachment = nestedAttachmentOrder[entity.id];
  const renderClass = deriveRenderClass(entity);

  if (attachment) {
    return [
      hostAnchor.position[0] + Math.cos(attachment.angle) * attachment.radius,
      hostAnchor.position[1] + Math.sin(attachment.angle) * attachment.radius,
      hostAnchor.position[2] + hostSize[2] * attachment.zBias
    ];
  }

  if (renderClass === 'diffuse_overlay') {
    return [
      hostAnchor.position[0],
      hostAnchor.position[1],
      hostAnchor.position[2] + Math.max(2, hostSize[2] * 0.25)
    ];
  }

  if (isMobileEntity(entity)) {
    return [
      hostAnchor.position[0] + randomInRange(next, -2.6, 2.6),
      hostAnchor.position[1] + randomInRange(next, -2.6, 2.6),
      entity.id.includes('Owl') ? hostAnchor.position[2] + hostSize[2] * 0.8 : hostAnchor.position[2] + 0.8
    ];
  }

  if (deriveRenderClass(entity) === 'bounded_translucent') {
    const angle = randomInRange(next, 0, Math.PI * 2);
    return [
      hostAnchor.position[0] + Math.cos(angle) * Math.max(2.2, hostSize[0] * 0.45),
      hostAnchor.position[1] + Math.sin(angle) * Math.max(2.2, hostSize[1] * 0.45),
      hostAnchor.position[2] + Math.max(0, hostSize[2] * 0.12)
    ];
  }

  const angle = randomInRange(next, 0, Math.PI * 2);
  return [
    hostAnchor.position[0] + Math.cos(angle) * Math.max(1.1, hostSize[0] * 0.28),
    hostAnchor.position[1] + Math.sin(angle) * Math.max(1.1, hostSize[1] * 0.28),
    hostAnchor.position[2] + Math.max(0.2, hostSize[2] * 0.18)
  ];
}

function findPreferredHostAnchor(
  bundle: NormalizedBundle,
  entity: NormalizedEntity,
  anchorByEntityId: Map<string, SpatialAnchor>
) {
  const directNestedParent = bundle.nestedLinks.find(
    (link) => link.child === entity.id && anchorByEntityId.has(link.parent)
  );

  if (directNestedParent) {
    return {
      host: anchorByEntityId.get(directNestedParent.parent)!,
      nestedParentId: directNestedParent.parent
    };
  }

  for (const preferredType of relationHostPreference) {
    const hostRelation = bundle.relations.find((relation) => {
      if (relation.type !== preferredType) {
        return false;
      }

      if (relation.from === entity.id) {
        return anchorByEntityId.has(relation.to);
      }

      if (relation.to === entity.id) {
        return anchorByEntityId.has(relation.from);
      }

      return false;
    });

    if (hostRelation) {
      const otherEntityId = hostRelation.from === entity.id ? hostRelation.to : hostRelation.from;
      return {
        host: anchorByEntityId.get(otherEntityId)!,
        nestedParentId: null
      };
    }
  }

  const anyPlacedRelation = bundle.relations.find(
    (relation) =>
      (relation.from === entity.id && anchorByEntityId.has(relation.to)) ||
      (relation.to === entity.id && anchorByEntityId.has(relation.from))
  );

  if (anyPlacedRelation) {
    const otherEntityId = anyPlacedRelation.from === entity.id ? anyPlacedRelation.to : anyPlacedRelation.from;
    return {
      host: anchorByEntityId.get(otherEntityId)!,
      nestedParentId: null
    };
  }

  return undefined;
}

function generateTuningWorld(bundle: NormalizedBundle, config: WorldSeedConfig): GeneratedWorld {
  const next = mulberry32(config.seed);
  const preset = bundle.worldPresets.find((candidate) => candidate.id === config.presetId) ?? bundle.worldPresets[0];

  if (!preset) {
    throw new Error(`Unknown world preset: ${config.presetId}`);
  }

  const anchors: SpatialAnchor[] = [];
  const entityTypeIndex: Record<string, string[]> = {};
  const anchorByEntityId = new Map<string, SpatialAnchor>();
  const addAnchor = (anchor: SpatialAnchor) => {
    anchors.push(anchor);
    anchorByEntityId.set(anchor.entityType, anchor);
    entityTypeIndex[anchor.entityType] = [anchor.id];
  };

  const heroEntity = bundle.entityIndex[preset.heroTree.entityId] ?? bundle.entityIndex.LargeOldEucalyptTree;

  if (!heroEntity) {
    throw new Error('The tuning world requires a LargeOldEucalyptTree hero entity.');
  }

  addAnchor(
    createAnchor(
      heroEntity,
      heroEntity.id,
      tuningAbsolutePositions[heroEntity.id] ?? [0, 0, 0],
      preset.heroTree.instanceParameterOverrides
    )
  );

  Object.entries(tuningAbsolutePositions).forEach(([entityId, position]) => {
    if (entityId === heroEntity.id || !bundle.entityIndex[entityId] || anchorByEntityId.has(entityId)) {
      return;
    }

    addAnchor(createAnchor(bundle.entityIndex[entityId]!, entityId, position));
  });

  const remainingEntities = [...bundle.entities]
    .filter((entity) => !anchorByEntityId.has(entity.id))
    .sort((left, right) => left.organisationScale.position01 - right.organisationScale.position01);

  remainingEntities.forEach((entity) => {
    const preferredHost = findPreferredHostAnchor(bundle, entity, anchorByEntityId);
    const position = preferredHost
      ? positionRelativeToHost(entity, preferredHost.host, next)
      : tuningHostFallbackPosition(entity, anchorByEntityId.get(heroEntity.id)!.position, next);

    addAnchor(
      createAnchor(entity, entity.id, position, {}, {
        hostAnchorId: preferredHost?.host.id ?? null,
        nestedParentAnchorId: preferredHost?.nestedParentId ?? null
      })
    );
  });

  const worldBounds = computeWorldBounds(anchors, 8);
  const anchorIndex = Object.fromEntries(anchors.map((anchor) => [anchor.id, anchor]));
  const relationCorridors = buildRelationCorridors(bundle.relations, entityTypeIndex);
  const chunks = buildSparseOctree(anchors, worldBounds, bundle.worldModel.voxelSizeLadderM);

  return {
    seed: config.seed,
    presetId: preset.id,
    viewMode: 'tuning_standard',
    anchors,
    anchorIndex,
    entityTypeIndex,
    relationCorridors,
    chunks,
    worldBounds
  };
}

function generateHectareWorld(bundle: NormalizedBundle, config: WorldSeedConfig): GeneratedWorld {
  const next = mulberry32(config.seed);
  const preset = bundle.worldPresets.find((candidate) => candidate.id === config.presetId) ?? bundle.worldPresets[0];

  if (!preset) {
    throw new Error(`Unknown world preset: ${config.presetId}`);
  }

  const extent = preset.extent;
  const worldBounds: GeneratedWorld['worldBounds'] = [0, 0, 0, extent.x, extent.y, extent.z];
  const anchors: SpatialAnchor[] = [];
  const entityTypeIndex: Record<string, string[]> = {};

  const addAnchor = (anchor: SpatialAnchor) => {
    anchors.push(anchor);
    entityTypeIndex[anchor.entityType] = [...(entityTypeIndex[anchor.entityType] ?? []), anchor.id];
  };

  const heroEntity = bundle.entityIndex[preset.heroTree.entityId]!;
  const heroAnchor = createAnchor(
    heroEntity,
    `${heroEntity.id}:hero`,
    preset.heroTree.position,
    preset.heroTree.instanceParameterOverrides
  );
  addAnchor(heroAnchor);

  preset.cohortDefaults.forEach((cohort) => {
    const entity = bundle.entityIndex[cohort.entityId];

    if (!entity) {
      return;
    }

    const count = Math.round(config.generationOverrides?.[cohort.entityId] ?? cohort.countDefault);

    for (let index = 0; index < count; index += 1) {
      const position = samplePatternPosition(cohort.spatialPattern, index, next, extent, heroAnchor.position);
      addAnchor(createAnchor(entity, `${entity.id}:${index}`, position));
    }
  });

  preset.faunaDefaults.forEach((fauna) => {
    const entity = bundle.entityIndex[fauna.entityId];

    if (!entity) {
      return;
    }

    const count = Math.round(config.generationOverrides?.[fauna.entityId] ?? fauna.countDefault);

    for (let index = 0; index < count; index += 1) {
      const position = chooseHectareFallbackPosition(entity, next, extent, heroAnchor.position);
      addAnchor(createAnchor(entity, `${entity.id}:${index}`, position));
    }
  });

  bundle.entities.forEach((entity) => {
    if ((entityTypeIndex[entity.id]?.length ?? 0) === 0) {
      addAnchor(
        createAnchor(
          entity,
          `${entity.id}:ghost`,
          chooseHectareFallbackPosition(entity, next, extent, heroAnchor.position)
        )
      );
    }
  });

  const anchorIndex = Object.fromEntries(anchors.map((anchor) => [anchor.id, anchor]));
  const relationCorridors = buildRelationCorridors(bundle.relations, entityTypeIndex);
  const chunks = buildSparseOctree(anchors, worldBounds, bundle.worldModel.voxelSizeLadderM);

  return {
    seed: config.seed,
    presetId: preset.id,
    viewMode: 'hectare_patch',
    anchors,
    anchorIndex,
    entityTypeIndex,
    relationCorridors,
    chunks,
    worldBounds
  };
}

export function generateWorld(bundle: NormalizedBundle, config: WorldSeedConfig): GeneratedWorld {
  return config.viewMode === 'hectare_patch'
    ? generateHectareWorld(bundle, config)
    : generateTuningWorld(bundle, config);
}

interface SimulationArrays {
  growth: Float32Array;
  hydration: Float32Array;
  decay: Float32Array;
  light: Float32Array;
  occupancy: Float32Array;
  velocityX: Float32Array;
  velocityY: Float32Array;
  velocityZ: Float32Array;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  fixed: Uint8Array;
}

function buildSimulationArrays(world: GeneratedWorld): SimulationArrays {
  const length = world.anchors.length;
  const arrays: SimulationArrays = {
    growth: new Float32Array(length),
    hydration: new Float32Array(length),
    decay: new Float32Array(length),
    light: new Float32Array(length),
    occupancy: new Float32Array(length),
    velocityX: new Float32Array(length),
    velocityY: new Float32Array(length),
    velocityZ: new Float32Array(length),
    x: new Float32Array(length),
    y: new Float32Array(length),
    z: new Float32Array(length),
    fixed: new Uint8Array(length)
  };

  world.anchors.forEach((anchor, index) => {
    arrays.growth[index] = anchor.fixedInWorld ? 0.55 : 0.35;
    arrays.hydration[index] = anchor.renderClass === 'diffuse_overlay' ? 0.74 : 0.62;
    arrays.decay[index] =
      anchor.entityType.includes('Dead') || anchor.entityType.includes('Log') ? 0.46 : anchor.renderClass === 'diffuse_overlay' ? 0.18 : 0.12;
    arrays.light[index] = anchor.position[2] > 8 ? 0.84 : 0.48;
    arrays.occupancy[index] = anchor.fixedInWorld ? 1 : 0.72;
    arrays.x[index] = anchor.position[0];
    arrays.y[index] = anchor.position[1];
    arrays.z[index] = anchor.position[2];
    arrays.fixed[index] = anchor.fixedInWorld ? 1 : 0;
  });

  return arrays;
}

function buildSnapshot(
  world: GeneratedWorld,
  arrays: SimulationArrays,
  revision: number,
  phase: TickPhase,
  currentDay: number,
  disturbancePressure: number
): FrameSnapshot {
  const positions = new Float32Array(world.anchors.length * 3);
  const sizes = new Float32Array(world.anchors.length * 3);
  const colors = new Float32Array(world.anchors.length * 3);

  let hydrationTotal = 0;
  let fixedAnchorCount = 0;

  world.anchors.forEach((anchor, index) => {
    positions[index * 3] = arrays.x[index]!;
    positions[index * 3 + 1] = arrays.y[index]!;
    positions[index * 3 + 2] = arrays.z[index]!;

    const size = anchorSize(anchor);
    sizes[index * 3] = size[0];
    sizes[index * 3 + 1] = size[1];
    sizes[index * 3 + 2] = size[2];

    const baseColor = deriveAnchorBaseColor(anchor);
    const hydrationTint = arrays.hydration[index]!;
    const decayTint = arrays.decay[index]!;

    colors[index * 3] = clamp(baseColor[0] - decayTint * 0.18 + hydrationTint * 0.05, 0.08, 1);
    colors[index * 3 + 1] = clamp(baseColor[1] + hydrationTint * 0.1 - disturbancePressure * 0.06, 0.08, 1);
    colors[index * 3 + 2] = clamp(baseColor[2] - decayTint * 0.06 + arrays.light[index]! * 0.05, 0.08, 1);

    hydrationTotal += arrays.hydration[index]!;
    fixedAnchorCount += anchor.fixedInWorld ? 1 : 0;
  });

  const relationEndpoints = new Float32Array(world.relationCorridors.length * 6);

  world.relationCorridors.forEach((corridor, index) => {
    const source = world.anchorIndex[corridor.sourceAnchorId]!;
    const target = world.anchorIndex[corridor.targetAnchorId]!;

    relationEndpoints[index * 6] = source.position[0];
    relationEndpoints[index * 6 + 1] = source.position[1];
    relationEndpoints[index * 6 + 2] = source.position[2] + 0.5;
    relationEndpoints[index * 6 + 3] = target.position[0];
    relationEndpoints[index * 6 + 4] = target.position[1];
    relationEndpoints[index * 6 + 5] = target.position[2] + 0.5;
  });

  const metrics: SimulationMetrics = {
    currentDay,
    phase,
    moisture: hydrationTotal / Math.max(world.anchors.length, 1),
    disturbancePressure,
    fixedAnchorCount,
    mobileAnchorCount: world.anchors.length - fixedAnchorCount
  };

  return {
    revision,
    worldSeed: world.seed,
    viewMode: world.viewMode,
    anchorIds: world.anchors.map((anchor) => anchor.id),
    anchorEntityTypes: world.anchors.map((anchor) => anchor.entityType),
    anchorLabels: world.anchors.map((anchor) => anchor.label),
    anchorKinds: world.anchors.map((anchor) => anchor.kind),
    anchorStarred: world.anchors.map((anchor) => anchor.starred),
    anchorFixed: world.anchors.map((anchor) => anchor.fixedInWorld),
    anchorRenderClasses: world.anchors.map((anchor) => anchor.renderClass),
    anchorOrganisationPositions: world.anchors.map((anchor) => anchor.organisationScale.position01),
    anchorOrganisationCheckpoints: world.anchors.map((anchor) => anchor.organisationScale.checkpointId),
    anchorLegacyScales: world.anchors.map((anchor) => anchor.legacyScale ?? ''),
    anchorHostAnchorIds: world.anchors.map((anchor) => anchor.hostAnchorId ?? null),
    anchorNestedParentAnchorIds: world.anchors.map((anchor) => anchor.nestedParentAnchorId ?? null),
    positions,
    sizes,
    colors,
    relationEndpoints,
    relationIds: world.relationCorridors.map((relation) => relation.id),
    relationLabels: world.relationCorridors.map((relation) => relation.label),
    relationStyleIds: world.relationCorridors.map((relation) => relation.styleId),
    relationStarred: world.relationCorridors.map((relation) => relation.starred),
    relationSourceAnchorIds: world.relationCorridors.map((relation) => relation.sourceAnchorId),
    relationTargetAnchorIds: world.relationCorridors.map((relation) => relation.targetAnchorId),
    worldBounds: world.worldBounds,
    metrics
  };
}

export class SimulationRuntime {
  private readonly rng: () => number;

  private world: GeneratedWorld;

  private arrays: SimulationArrays;

  private revision = 0;

  private currentDay = 0;

  private disturbancePressure = 0;

  private phase: TickPhase = 'conservation';

  constructor(
    private bundle: NormalizedBundle,
    private config: WorldSeedConfig
  ) {
    this.rng = mulberry32(config.seed + 17);
    this.world = generateWorld(bundle, config);
    this.arrays = buildSimulationArrays(this.world);
  }

  rebuild(bundle: NormalizedBundle, config: WorldSeedConfig) {
    this.bundle = bundle;
    this.config = config;
    this.world = generateWorld(bundle, config);
    this.arrays = buildSimulationArrays(this.world);
    this.revision += 1;
  }

  getWorld() {
    return this.world;
  }

  getSnapshot() {
    return buildSnapshot(this.world, this.arrays, this.revision, this.phase, this.currentDay, this.disturbancePressure);
  }

  advanceDay(days = 1) {
    for (let day = 0; day < days; day += 1) {
      this.currentDay += 1;

      const seasonalMoisture = 0.55 + Math.sin((this.currentDay / 365) * Math.PI * 2) * 0.12;

      for (let index = 0; index < this.world.anchors.length; index += 1) {
        this.arrays.hydration[index] = clamp(
          this.arrays.hydration[index]! + (seasonalMoisture - 0.5) * 0.08 - this.disturbancePressure * 0.03,
          0,
          1
        );
        this.arrays.light[index] = clamp(
          0.45 + Math.sin((this.currentDay / 365) * Math.PI * 2 + index * 0.07) * 0.18,
          0,
          1
        );
        this.arrays.occupancy[index] = clamp(
          this.arrays.occupancy[index]! + (this.arrays.hydration[index]! - 0.5) * 0.05,
          0,
          1
        );

        if (this.arrays.fixed[index] === 0) {
          this.arrays.velocityX[index] = clamp(this.arrays.velocityX[index]! + (this.rng() - 0.5) * 0.08, -0.4, 0.4);
          this.arrays.velocityY[index] = clamp(this.arrays.velocityY[index]! + (this.rng() - 0.5) * 0.08, -0.4, 0.4);
          this.arrays.x[index] = clamp(
            this.arrays.x[index]! + this.arrays.velocityX[index]!,
            this.world.worldBounds[0] + 1,
            this.world.worldBounds[3] - 1
          );
          this.arrays.y[index] = clamp(
            this.arrays.y[index]! + this.arrays.velocityY[index]!,
            this.world.worldBounds[1] + 1,
            this.world.worldBounds[4] - 1
          );
        }
      }

      if (this.currentDay % 365 === 0) {
        this.advanceYear();
      }

      if (this.currentDay % 3650 === 0) {
        this.advanceDecade();
      }

      this.phase = this.disturbancePressure > 0.72
        ? 'release'
        : this.disturbancePressure > 0.38
          ? 'reorganization'
          : this.currentDay % 365 < 110
            ? 'growth'
            : 'conservation';

      this.disturbancePressure = clamp(this.disturbancePressure * 0.996, 0, 1);
    }

    this.revision += 1;
  }

  private advanceYear() {
    for (let index = 0; index < this.world.anchors.length; index += 1) {
      this.arrays.growth[index] = clamp(this.arrays.growth[index]! + this.arrays.hydration[index]! * 0.04, 0, 1);
      this.arrays.decay[index] = clamp(
        this.arrays.decay[index]! +
          (this.world.anchors[index]!.entityType.includes('Dead') || this.world.anchors[index]!.entityType.includes('Log')
            ? 0.05
            : 0.01) +
          this.disturbancePressure * 0.03,
        0,
        1
      );
    }
  }

  private advanceDecade() {
    for (let index = 0; index < this.world.anchors.length; index += 1) {
      this.arrays.decay[index] = clamp(this.arrays.decay[index]! + 0.08, 0, 1);
      this.arrays.growth[index] = clamp(this.arrays.growth[index]! - 0.03 + this.arrays.hydration[index]! * 0.05, 0, 1);
    }
  }

  triggerDisturbance(type: DisturbanceType, intensity = 1) {
    const resolvedIntensity = clamp(intensity, 0, 1);
    this.disturbancePressure = clamp(this.disturbancePressure + resolvedIntensity * 0.65, 0, 1);
    this.phase = 'release';

    for (let index = 0; index < this.world.anchors.length; index += 1) {
      switch (type) {
        case 'wildfire':
          this.arrays.hydration[index] = clamp(this.arrays.hydration[index]! - 0.28 * resolvedIntensity, 0, 1);
          this.arrays.decay[index] = clamp(this.arrays.decay[index]! + 0.16 * resolvedIntensity, 0, 1);
          break;
        case 'drought':
          this.arrays.hydration[index] = clamp(this.arrays.hydration[index]! - 0.22 * resolvedIntensity, 0, 1);
          break;
        case 'logging':
          this.arrays.occupancy[index] = clamp(this.arrays.occupancy[index]! - 0.18 * resolvedIntensity, 0, 1);
          this.arrays.decay[index] = clamp(this.arrays.decay[index]! + 0.08 * resolvedIntensity, 0, 1);
          break;
        case 'parameter_shock':
          this.arrays.growth[index] = clamp(this.arrays.growth[index]! - 0.12 * resolvedIntensity, 0, 1);
          break;
      }
    }

    this.revision += 1;
  }

  describeSelection(selection: { kind: 'anchor' | 'relation'; id: string } | undefined): SelectionOverlay | undefined {
    if (!selection) {
      return undefined;
    }

    if (selection.kind === 'anchor') {
      const anchor = this.world.anchorIndex[selection.id];

      if (!anchor) {
        return undefined;
      }

      return {
        id: anchor.id,
        kind: 'anchor',
        label: anchor.label,
        starred: anchor.starred,
        subtitle: `${anchor.entityType} · ${anchor.organisationScale.checkpointId}`,
        details: {
          fixedInWorld: anchor.fixedInWorld,
          voxelCount: anchor.occupancyVoxels.length,
          organisationPosition: Number(anchor.organisationScale.position01.toFixed(2)),
          renderClass: anchor.renderClass,
          nestedDepth: organisationCheckpointOrder.get(anchor.organisationScale.checkpointId) ?? 0
        }
      };
    }

    const relation = this.world.relationCorridors.find((item) => item.id === selection.id);

    if (!relation) {
      return undefined;
    }

    return {
      id: relation.id,
      kind: 'relation',
      label: relation.label,
      starred: relation.starred,
      subtitle: `${relation.type} · ${relation.styleId}`,
      details: {
        source: relation.sourceAnchorId,
        target: relation.targetAnchorId,
        particleDensity: relationTrailStyles[relation.styleId].particleDensity
      }
    };
  }
}

export function createSimulationRuntime(bundle: NormalizedBundle, config: WorldSeedConfig) {
  return new SimulationRuntime(bundle, config);
}
