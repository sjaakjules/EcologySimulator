import * as THREE from 'three';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import {
  relationTrailStyles,
  type CameraState,
  type FrameSnapshot,
  type RelationTrailStyleId,
  type SelectionOverlay
} from '@ecology/domain';
import type { NormalizedBundle } from '@ecology/schema';
import type {
  RenderGlowMode,
  RenderTransparencyMode,
  RenderVisualSettings,
  RendererCapabilities,
  RendererStats
} from '@ecology/worker-runtime';

import {
  allocatePointBudget,
  allocateWeightedCounts,
  buildInterleavedIndexOrder,
  circleOfConfusion,
  clamp,
  clampPointSizeToRange,
  pointBudgetCaps,
  recommendedBudgetPreset,
  resolvePointBudget,
  visiblePointCount
} from './point-cloud';

type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;
type Vec3 = [number, number, number];
type ShapeKind = 'cloud' | 'column' | 'disc' | 'ellipsoid' | 'log' | 'ring' | 'sheet';

interface HighlightState {
  active: boolean;
  anchorLevels: Map<string, number>;
  relationLevels: Map<string, number>;
}

interface BudgetPlan {
  droppedPoints: number;
  entityCounts: number[];
  entityTotal: number;
  relationCounts: number[];
  relationTotal: number;
}

interface PointStateTexture {
  array: Float32Array;
  texture: THREE.DataTexture;
}

interface RuntimeUniformSet {
  setValue(name: string, value: THREE.Texture | THREE.Color | number | boolean | THREE.Vector2): void;
}

interface EntityMaterialPair {
  core: THREE.ShaderMaterial;
  halo: THREE.ShaderMaterial;
}

interface RelationMaterials {
  cloud: THREE.ShaderMaterial;
}

const ENTITY_VERTEX_SHADER = `
precision highp float;
precision highp int;

attribute float aAnchorIndex;
attribute float aSize;
attribute float aAlpha;

uniform sampler2D uStateTexture;
uniform float uStateResolution;
uniform float uViewportHeight;
uniform float uMaxPointSize;
uniform float uFocusDistance;
uniform float uDofEnabled;
uniform float uDofStrength;
uniform float uSoftAlpha;
uniform float uGlowEnabled;
uniform float uPassType;
uniform float uHasHighlights;

varying vec3 vColor;
varying float vAlpha;
varying float vSoftness;
varying float vPassType;

vec2 stateUv(float index, float resolution) {
  return vec2((index + 0.5) / max(1.0, resolution), 0.5);
}

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vec4 state = texture2D(uStateTexture, stateUv(aAnchorIndex, uStateResolution));
  float level = state.r;
  float alphaMul = state.g;
  float sizeMul = state.b;
  float haloMul = state.a;
  vec3 finalColor = color;

  if (uHasHighlights > 0.5) {
    if (level > 2.5) {
      finalColor = mix(finalColor, vec3(1.0, 0.89, 0.67), 0.72);
    } else if (level > 1.5) {
      finalColor = mix(finalColor, vec3(0.55, 0.89, 1.0), 0.48);
    } else if (level > 0.5) {
      finalColor = mix(finalColor, vec3(0.61, 0.95, 0.82), 0.24);
    } else {
      finalColor = mix(finalColor, vec3(0.11, 0.21, 0.19), 0.38);
    }
  }

  float viewDistance = max(1.0, -mvPosition.z);
  float coc = clamp(abs(uFocusDistance - viewDistance) / viewDistance * uDofStrength * uDofEnabled, 0.0, 1.0);
  float size = max(1.0, aSize * sizeMul * (uViewportHeight * 0.16) / max(18.0, viewDistance));

  if (uPassType > 0.5) {
    size *= mix(1.35, 2.6, haloMul);
  } else {
    size *= 1.0 + coc * 1.2;
  }

  gl_PointSize = clamp(size, 1.0, uMaxPointSize);
  gl_Position = projectionMatrix * mvPosition;
  vColor = finalColor;
  vSoftness = coc;
  vPassType = uPassType;

  if (uPassType > 0.5) {
    vAlpha = uGlowEnabled > 0.5 ? (0.06 + haloMul * 0.2) : 0.0;
  } else {
    vAlpha = aAlpha * alphaMul;
  }
}
`;

const ENTITY_FRAGMENT_SHADER = `
precision highp float;
precision highp int;

uniform float uSoftAlpha;
uniform float uPassType;

varying vec3 vColor;
varying float vAlpha;
varying float vSoftness;
varying float vPassType;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float distanceToCenter = length(centered);
  float alpha = 0.0;

  if (vPassType > 0.5) {
    alpha = smoothstep(0.62, 0.04, distanceToCenter) * vAlpha;
  } else if (uSoftAlpha > 0.5) {
    alpha = smoothstep(0.58 + vSoftness * 0.18, 0.06, distanceToCenter) * vAlpha;
  } else {
    alpha = (1.0 - smoothstep(0.42, 0.5 + vSoftness * 0.08, distanceToCenter)) * vAlpha;
  }

  if (alpha <= 0.01) {
    discard;
  }

  gl_FragColor = vec4(vColor, alpha);
}
`;

const RELATION_VERTEX_SHADER = `
precision highp float;
precision highp int;

attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec3 aEndColor;
attribute float aPhaseOffset;
attribute float aLane;
attribute float aRelationIndex;
attribute float aStyleIndex;
attribute float aSize;

uniform sampler2D uStateTexture;
uniform float uStateResolution;
uniform float uTime;
uniform float uViewportHeight;
uniform float uMaxPointSize;
uniform float uFocusDistance;
uniform float uDofEnabled;
uniform float uDofStrength;
uniform float uGlowEnabled;

varying vec3 vColor;
varying float vAlpha;
varying float vSoftness;

vec2 stateUv(float index, float resolution) {
  return vec2((index + 0.5) / max(1.0, resolution), 0.5);
}

float styleSpeed(float styleIndex) {
  if (styleIndex < 0.5) return 0.75;
  if (styleIndex < 1.5) return 0.45;
  if (styleIndex < 2.5) return 0.55;
  if (styleIndex < 3.5) return 1.15;
  if (styleIndex < 4.5) return 0.28;
  return 1.35;
}

vec3 styleColor(float styleIndex) {
  if (styleIndex < 0.5) return vec3(0.85, 0.96, 0.62);
  if (styleIndex < 1.5) return vec3(0.55, 0.89, 1.0);
  if (styleIndex < 2.5) return vec3(1.0, 0.83, 0.47);
  if (styleIndex < 3.5) return vec3(1.0, 0.56, 0.42);
  if (styleIndex < 4.5) return vec3(0.66, 0.94, 0.77);
  return vec3(1.0, 0.75, 0.4);
}

vec3 curvePoint(vec3 start, vec3 end, float t, float styleIndex, float lane) {
  vec3 delta = end - start;
  float distance = max(length(delta), 0.001);
  vec3 forward = delta / distance;
  vec3 upReference = abs(forward.z) > 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec3 right = normalize(cross(forward, upReference));
  vec3 up = normalize(cross(right, forward));
  vec3 base = mix(start, end, t);
  float arc = sin(t * 3.14159265);
  float laneOffset = lane * distance * 0.035;

  if (styleIndex < 0.5) {
    return base + up * arc * max(1.4, distance * 0.16) + right * laneOffset;
  }

  if (styleIndex < 1.5) {
    return base
      + up * arc * max(2.1, distance * 0.24) * (0.55 + 0.45 * sin(t * 6.2831853 + lane * 4.0))
      + right * sin(t * 12.5663706 + lane * 5.0) * distance * 0.08;
  }

  if (styleIndex < 2.5) {
    return base + up * arc * max(1.2, distance * 0.12) + right * laneOffset * 0.7;
  }

  if (styleIndex < 3.5) {
    return base + up * arc * max(2.6, distance * 0.28);
  }

  if (styleIndex < 4.5) {
    return base
      + right * sin(t * 18.8495559 + lane * 6.0) * distance * 0.12
      + up * arc * max(0.8, distance * 0.08);
  }

  return base + up * arc * max(0.5, distance * 0.05) + right * laneOffset * 0.4;
}

void main() {
  vec4 relationState = texture2D(uStateTexture, stateUv(aRelationIndex, uStateResolution));
  float level = relationState.r;
  float alphaMul = relationState.g;
  float sizeMul = relationState.b;
  float glowMul = relationState.a;
  float progress = fract(aPhaseOffset + uTime * styleSpeed(aStyleIndex) * 0.055);
  vec3 worldPoint = curvePoint(aStart, aEnd, progress, aStyleIndex, aLane);
  vec4 mvPosition = modelViewMatrix * vec4(worldPoint, 1.0);
  float viewDistance = max(1.0, -mvPosition.z);
  float coc = clamp(abs(uFocusDistance - viewDistance) / viewDistance * uDofStrength * uDofEnabled, 0.0, 1.0);
  float size = max(1.0, mix(aSize * 0.9, aSize * 1.2, progress) * sizeMul * (uViewportHeight * 0.14) / max(16.0, viewDistance));
  float pointSize = clamp(size * (1.0 + coc * 0.9 + glowMul * 0.7), 1.0, uMaxPointSize);

  gl_PointSize = pointSize;
  gl_Position = projectionMatrix * mvPosition;
  vSoftness = coc;

  vec3 finalColor = mix(color, aEndColor, progress);
  finalColor = mix(finalColor, styleColor(aStyleIndex), 0.28);
  if (level > 2.5) {
    finalColor = mix(finalColor, vec3(1.0, 0.89, 0.67), 0.52);
  } else if (level > 1.5) {
    finalColor = mix(finalColor, vec3(0.55, 0.89, 1.0), 0.34);
  } else if (level > 0.5) {
    finalColor = mix(finalColor, vec3(0.61, 0.95, 0.82), 0.18);
  }
  vColor = finalColor;
  vAlpha = (uGlowEnabled > 0.5 ? 0.62 : 0.48) * alphaMul;
}
`;

const RELATION_FRAGMENT_SHADER = `
precision highp float;
precision highp int;

varying vec3 vColor;
varying float vAlpha;
varying float vSoftness;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float distanceToCenter = length(centered);
  float alpha = smoothstep(0.62 + vSoftness * 0.08, 0.08, distanceToCenter) * vAlpha;

  if (alpha <= 0.01) {
    discard;
  }

  gl_FragColor = vec4(vColor, alpha);
}
`;

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
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

function requestFrame(callback: FrameRequestCallback) {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }

  return setTimeout(() => callback(performance.now()), 16) as unknown as number;
}

function cancelFrame(handle: number) {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle);
  }
}

function shapeForAnchor(entityType: string, kind: string, renderClass: string): ShapeKind {
  if (entityType === 'LargeOldEucalyptTree' || entityType === 'StandingDeadTree' || entityType === 'TreeFernGuild') {
    return 'column';
  }

  if (entityType === 'FallenLog' || entityType === 'CoarseWoodyBranchMat') {
    return 'log';
  }

  if (entityType === 'CanopyGapField') {
    return 'ring';
  }

  if (entityType === 'SunlightField') {
    return 'sheet';
  }

  if (renderClass === 'diffuse_overlay') {
    return 'cloud';
  }

  if (
    kind === 'population' ||
    kind === 'colony' ||
    kind === 'guild' ||
    kind === 'community' ||
    kind === 'cohort' ||
    kind === 'place_patch'
  ) {
    return 'disc';
  }

  return 'ellipsoid';
}

function sampleEllipsoid(size: THREE.Vector3, next: () => number) {
  const radius = Math.cbrt(next());
  const theta = next() * Math.PI * 2;
  const phi = Math.acos(1 - 2 * next());
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta) * size.x * 0.5 * radius,
    Math.sin(phi) * Math.sin(theta) * size.y * 0.5 * radius,
    Math.cos(phi) * size.z * 0.5 * radius
  );
}

function sampleDisc(size: THREE.Vector3, next: () => number) {
  const radius = Math.sqrt(next());
  const theta = next() * Math.PI * 2;
  return new THREE.Vector3(
    Math.cos(theta) * size.x * 0.5 * radius,
    Math.sin(theta) * size.y * 0.5 * radius,
    (next() - 0.5) * Math.max(0.18, size.z * 0.22)
  );
}

function sampleColumn(size: THREE.Vector3, next: () => number) {
  const radius = Math.sqrt(next());
  const theta = next() * Math.PI * 2;
  return new THREE.Vector3(
    Math.cos(theta) * Math.max(0.2, size.x * 0.28) * radius,
    Math.sin(theta) * Math.max(0.2, size.y * 0.28) * radius,
    -size.z * 0.5 + next() * size.z
  );
}

function sampleRing(size: THREE.Vector3, next: () => number) {
  const inner = 0.42 + next() * 0.38;
  const theta = next() * Math.PI * 2;
  return new THREE.Vector3(
    Math.cos(theta) * size.x * 0.5 * inner,
    Math.sin(theta) * size.y * 0.5 * inner,
    (next() - 0.5) * Math.max(0.2, size.z * 0.18)
  );
}

function sampleSheet(size: THREE.Vector3, next: () => number) {
  return new THREE.Vector3(
    (next() - 0.5) * size.x,
    (next() - 0.5) * size.y,
    (next() - 0.5) * Math.max(0.35, size.z * 0.12)
  );
}

function sampleCloud(size: THREE.Vector3, next: () => number) {
  const radius = Math.sqrt(next());
  const theta = next() * Math.PI * 2;
  return new THREE.Vector3(
    Math.cos(theta) * size.x * 0.6 * radius,
    Math.sin(theta) * size.y * 0.6 * radius,
    (next() - 0.35) * size.z * (0.45 + next() * 0.6)
  );
}

function sampleLog(size: THREE.Vector3, next: () => number) {
  const along = (next() - 0.5) * size.x;
  const radius = Math.sqrt(next());
  const theta = next() * Math.PI * 2;
  return new THREE.Vector3(
    along,
    Math.cos(theta) * Math.max(0.2, size.y * 0.45) * radius,
    Math.sin(theta) * Math.max(0.16, size.z * 0.45) * radius
  );
}

function sampleTreeLikePoint(entityType: string, size: THREE.Vector3, next: () => number) {
  if (entityType === 'TreeFernGuild') {
    if (next() < 0.42) {
      return sampleColumn(new THREE.Vector3(size.x * 0.26, size.y * 0.26, size.z * 0.82), next);
    }

    const crown = sampleDisc(new THREE.Vector3(size.x * 1.9, size.y * 1.9, size.z * 0.2), next);
    crown.z += size.z * 0.36;
    return crown;
  }

  if (entityType === 'StandingDeadTree') {
    if (next() < 0.72) {
      return sampleColumn(new THREE.Vector3(size.x * 0.82, size.y * 0.82, size.z), next);
    }

    const breakCluster = sampleEllipsoid(new THREE.Vector3(size.x * 1.2, size.y * 1.2, size.z * 0.12), next);
    breakCluster.z += size.z * 0.35;
    return breakCluster;
  }

  if (next() < 0.45) {
    return sampleColumn(new THREE.Vector3(size.x, size.y, size.z), next);
  }

  const crownWidth = Math.max(8, size.z * 0.24);
  const crown = sampleEllipsoid(new THREE.Vector3(crownWidth, crownWidth, Math.max(4, size.z * 0.22)), next);
  crown.z += size.z * 0.24;
  return crown;
}

function sampleAnchorPoint(
  entityType: string,
  kind: string,
  renderClass: string,
  size: THREE.Vector3,
  next: () => number
) {
  const shape = shapeForAnchor(entityType, kind, renderClass);

  switch (shape) {
    case 'column':
      return sampleTreeLikePoint(entityType, size, next);
    case 'disc':
      return sampleDisc(size, next);
    case 'ring':
      return sampleRing(size, next);
    case 'sheet':
      return sampleSheet(size, next);
    case 'cloud':
      return sampleCloud(size, next);
    case 'log':
      return sampleLog(size, next);
    default:
      return sampleEllipsoid(size, next);
  }
}

function pointSizeForAnchor(snapshot: FrameSnapshot, index: number) {
  const renderClass = snapshot.anchorRenderClasses[index];
  const kind = snapshot.anchorKinds[index];

  if (renderClass === 'diffuse_overlay') {
    return 1.75;
  }

  if (kind === 'population' || kind === 'colony') {
    return 1.5;
  }

  if (kind === 'guild' || kind === 'community' || kind === 'cohort') {
    return 1.7;
  }

  return 1.95;
}

function pointAlphaForAnchor(snapshot: FrameSnapshot, index: number) {
  const renderClass = snapshot.anchorRenderClasses[index];
  return renderClass === 'diffuse_overlay' ? 0.2 : renderClass === 'bounded_translucent' ? 0.46 : 0.74;
}

function pointWeightForAnchor(snapshot: FrameSnapshot, index: number) {
  const sx = snapshot.sizes[index * 3] ?? 1;
  const sy = snapshot.sizes[index * 3 + 1] ?? 1;
  const sz = snapshot.sizes[index * 3 + 2] ?? 1;
  const renderClass = snapshot.anchorRenderClasses[index];
  const extentFactor = Math.max(sx, sy, sz) * 0.85 + Math.cbrt(Math.max(1, sx * sy * sz)) * 3.8;
  return extentFactor * (renderClass === 'diffuse_overlay' ? 0.9 : renderClass === 'bounded_translucent' ? 1.05 : 1.18);
}

function requestedPointCountForAnchor(snapshot: FrameSnapshot, index: number) {
  const entityType = snapshot.anchorEntityTypes[index];
  const weight = pointWeightForAnchor(snapshot, index);
  return Math.round(clamp(weight * 220, entityType === 'LargeOldEucalyptTree' ? 900 : 180, entityType === 'LargeOldEucalyptTree' ? 16_000 : 8_000));
}

function pointWeightForRelation(snapshot: FrameSnapshot, index: number) {
  const style = relationTrailStyles[snapshot.relationStyleIds[index] ?? 'resource_flow'];
  const startX = snapshot.relationEndpoints[index * 6] ?? 0;
  const startY = snapshot.relationEndpoints[index * 6 + 1] ?? 0;
  const startZ = snapshot.relationEndpoints[index * 6 + 2] ?? 0;
  const endX = snapshot.relationEndpoints[index * 6 + 3] ?? 0;
  const endY = snapshot.relationEndpoints[index * 6 + 4] ?? 0;
  const endZ = snapshot.relationEndpoints[index * 6 + 5] ?? 0;
  const distance = Math.hypot(endX - startX, endY - startY, endZ - startZ);
  return style.particleDensity * 2.8 + distance * 0.9;
}

function requestedPointCountForRelation(snapshot: FrameSnapshot, index: number) {
  const style = relationTrailStyles[snapshot.relationStyleIds[index] ?? 'resource_flow'];
  const weight = pointWeightForRelation(snapshot, index);
  return Math.round(clamp(weight * 48, style.particleDensity * 12, style.particleDensity * 320));
}

function createStateTexture(size: number) {
  const width = Math.max(1, size);
  const array = new Float32Array(width * 4);
  const texture = new THREE.DataTexture(array, width, 1, THREE.RGBAFormat, THREE.FloatType);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;

  return { array, texture } satisfies PointStateTexture;
}

function ensureStateTexture(current: PointStateTexture | undefined, size: number) {
  if (!current || current.texture.image.width !== Math.max(1, size)) {
    current?.texture.dispose();
    return createStateTexture(size);
  }

  return current;
}

function materialUniforms(
  maxPointSize: number,
  resolution = new THREE.Vector2(1280, 820)
): Record<string, THREE.IUniform> {
  return {
    uStateTexture: { value: null },
    uStateResolution: { value: 1 },
    uViewportHeight: { value: resolution.y },
    uMaxPointSize: { value: maxPointSize },
    uFocusDistance: { value: 32 },
    uDofEnabled: { value: 1 },
    uDofStrength: { value: 1.1 },
    uSoftAlpha: { value: 0 },
    uGlowEnabled: { value: 1 },
    uPassType: { value: 0 },
    uHasHighlights: { value: 0 },
    uTime: { value: 0 }
  };
}

function createEntityMaterials(maxPointSize: number, resolution?: THREE.Vector2): EntityMaterialPair {
  const core = new THREE.ShaderMaterial({
    alphaToCoverage: true,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: true,
    transparent: true,
    uniforms: materialUniforms(maxPointSize, resolution),
    vertexColors: true,
    vertexShader: ENTITY_VERTEX_SHADER,
    fragmentShader: ENTITY_FRAGMENT_SHADER
  });
  const halo = new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    uniforms: materialUniforms(maxPointSize, resolution),
    vertexColors: true,
    vertexShader: ENTITY_VERTEX_SHADER,
    fragmentShader: ENTITY_FRAGMENT_SHADER
  });

  halo.uniforms.uPassType.value = 1;

  return { core, halo };
}

function createRelationMaterial(maxPointSize: number, resolution?: THREE.Vector2) {
  return new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    uniforms: materialUniforms(maxPointSize, resolution),
    vertexColors: true,
    vertexShader: RELATION_VERTEX_SHADER,
    fragmentShader: RELATION_FRAGMENT_SHADER
  });
}

async function createRenderer(canvas: RenderCanvas, width: number, height: number, dpr: number, offscreenCanvas: boolean) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    canvas
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);

  const debug = renderer.debug as { onShaderError?: (...args: unknown[]) => void };
  if (debug) {
    debug.onShaderError = () => undefined;
  }

  const gl = renderer.getContext();
  const aliasedPointSizeRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as [number, number];
  const capabilities = {
    backend: 'webgl' as const,
    webgl2: renderer.capabilities.isWebGL2,
    offscreenCanvas,
    aliasedPointSizeRange: [Number(aliasedPointSizeRange[0] ?? 1), Number(aliasedPointSizeRange[1] ?? 64)] as [number, number],
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) ?? renderer.capabilities.maxTextureSize ?? 4096),
    maxVertexTextureImageUnits: Number(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) ?? 0),
    recommendedBudgetPreset: recommendedBudgetPreset(
      renderer.capabilities.isWebGL2,
      [Number(aliasedPointSizeRange[0] ?? 1), Number(aliasedPointSizeRange[1] ?? 64)],
      Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) ?? renderer.capabilities.maxTextureSize ?? 4096),
      Number(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) ?? 0)
    )
  } satisfies RendererCapabilities;

  return { capabilities, renderer };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(vector: Vec3, factor: number): Vec3 {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function length(vector: Vec3) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector: Vec3): Vec3 {
  const value = length(vector);
  if (value <= 1e-6) {
    return [0, 0, 0];
  }

  return scale(vector, 1 / value);
}

function forwardFromAngles(yaw: number, pitch: number): Vec3 {
  return [
    Math.cos(pitch) * Math.cos(yaw),
    Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch)
  ];
}

export class EcologySceneRuntime {
  private renderer?: THREE.WebGLRenderer;

  private composer?: EffectComposer;

  private renderPass?: RenderPass;

  private bokehPass?: BokehPass;

  private bloomPass?: UnrealBloomPass;

  private capabilities?: RendererCapabilities;

  private readonly scene = new THREE.Scene();

  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1000);

  private readonly entityGroup = new THREE.Group();

  private readonly relationGroup = new THREE.Group();

  private readonly pickGroup = new THREE.Group();

  private readonly groundGrid = new THREE.GridHelper(220, 22, '#335f55', '#18342f');

  private readonly raycaster = new THREE.Raycaster();

  private readonly pointer = new THREE.Vector2();

  private frameHandle = 0;

  private width = 1280;

  private height = 820;

  private lastTimeSeconds = 0;

  private budgetPlan?: BudgetPlan;

  private bundle?: NormalizedBundle;

  private snapshot?: FrameSnapshot;

  private selection?: SelectionOverlay;

  private hoveredSelection?: { kind: 'anchor' | 'relation'; id: string };

  private visuals: RenderVisualSettings = {
    cameraZoom: 0.48,
    holarchyDepth: 0.48,
    pointBudgetPreset: 'balanced',
    maxPoints: pointBudgetCaps.balanced,
    dofMode: 'shader',
    focusDistance: 28,
    focusLock: 'camera',
    glowMode: 'halo',
    transparencyMode: 'solid_core'
  };

  private currentCamera: CameraState = {
    position: [44, -26, 28],
    yaw: 2.84,
    pitch: -0.5
  };

  private entityPoints?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private entityHalo?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private relationPoints?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private relationPickProxy?: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

  private entityMaterials?: EntityMaterialPair;

  private relationMaterials?: RelationMaterials;

  private anchorState?: PointStateTexture;

  private relationState?: PointStateTexture;

  private entityPointAnchorIds: string[] = [];

  private relationPointRelationIds: string[] = [];

  private relationSegmentRelationIds: string[] = [];

  private pickableObjects: THREE.Object3D[] = [];

  private readonly relationIdsByAnchorId = new Map<string, Set<string>>();

  private readonly relationEndpointsById = new Map<string, { source: string; target: string }>();

  private readonly nestedAnchorIdsByAnchorId = new Map<string, Set<string>>();

  private highlightState: HighlightState = {
    active: false,
    anchorLevels: new Map(),
    relationLevels: new Map()
  };

  constructor(
    private readonly canvas: RenderCanvas,
    private readonly onPick?: (selection?: { kind: 'anchor' | 'relation'; id: string }) => void,
    private readonly onReady?: (capabilities: RendererCapabilities) => void,
    private readonly onHover?: (selection?: { kind: 'anchor' | 'relation'; id: string }) => void,
    private readonly onStats?: (stats: RendererStats) => void,
    private readonly onLog?: (message: string) => void,
    private readonly runtimeBackend: 'worker' | 'main-thread' = 'worker'
  ) {
    this.scene.background = new THREE.Color('#081312');
    this.scene.fog = new THREE.Fog('#081312', 80, 220);
    this.camera.up.set(0, 0, 1);
    this.raycaster.params.Points.threshold = 2.4;
    this.raycaster.params.Line.threshold = 2.4;

    const ambient = new THREE.HemisphereLight('#dce9d6', '#132419', 1.08);
    const sun = new THREE.DirectionalLight('#ffe3af', 1.2);
    sun.position.set(60, -80, 120);
    const fill = new THREE.DirectionalLight('#86b4b0', 0.45);
    fill.position.set(-50, 60, 40);

    this.groundGrid.rotateX(Math.PI / 2);
    this.groundGrid.position.set(0, 0, 0);
    const gridMaterials = Array.isArray(this.groundGrid.material) ? this.groundGrid.material : [this.groundGrid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.22;
    });

    this.scene.add(ambient, sun, fill, this.groundGrid, this.entityGroup, this.relationGroup, this.pickGroup);
    this.camera.position.fromArray(this.currentCamera.position);
  }

  async init(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;

    try {
      const { capabilities, renderer } = await createRenderer(
        this.canvas,
        width,
        height,
        dpr,
        this.canvas instanceof OffscreenCanvas
      );
      this.renderer = renderer;
      this.capabilities = capabilities;
      this.visuals = {
        ...this.visuals,
        pointBudgetPreset: capabilities.recommendedBudgetPreset,
        maxPoints: pointBudgetCaps[capabilities.recommendedBudgetPreset]
      };
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.entityMaterials = createEntityMaterials(capabilities.aliasedPointSizeRange[1], new THREE.Vector2(width, height));
      this.relationMaterials = {
        cloud: createRelationMaterial(capabilities.aliasedPointSizeRange[1], new THREE.Vector2(width, height))
      };
      this.updateMaterialUniforms();
      this.onReady?.(capabilities);
      this.emitStats();
      this.startLoop();
    } catch (error) {
      this.onLog?.(`Renderer initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}.`);
      throw error;
    }
  }

  dispose() {
    if (this.frameHandle) {
      cancelFrame(this.frameHandle);
      this.frameHandle = 0;
    }

    this.disposePoints(this.entityPoints);
    this.disposePoints(this.entityHalo);
    this.disposePoints(this.relationPoints);
    this.disposeLineSegments(this.relationPickProxy);
    this.anchorState?.texture.dispose();
    this.relationState?.texture.dispose();
    this.entityMaterials?.core.dispose();
    this.entityMaterials?.halo.dispose();
    this.relationMaterials?.cloud.dispose();
    this.bokehPass?.dispose();
    this.bloomPass?.dispose();
    this.composer?.dispose();
    this.renderer?.dispose();
  }

  resize(width: number, height: number, dpr: number) {
    if (!this.renderer) {
      return;
    }

    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.composer?.setPixelRatio(dpr);
    this.composer?.setSize(width, height);
    this.bokehPass?.setSize(width * dpr, height * dpr);
    this.bloomPass?.setSize(width * dpr * 0.5, height * dpr * 0.5);
    this.updateMaterialUniforms();
  }

  setBundle(bundle: NormalizedBundle) {
    this.bundle = bundle;
    this.buildNestedLookup();
    this.updateInteractionHighlights();
  }

  setCamera(camera: CameraState) {
    this.currentCamera = camera;
    this.updateMaterialUniforms();
  }

  setVisuals(visuals: RenderVisualSettings) {
    const nextMaxPoints = resolvePointBudget(visuals.pointBudgetPreset, visuals.maxPoints);
    const previous = this.visuals;

    this.visuals = {
      ...visuals,
      maxPoints: nextMaxPoints
    };

    const requiresRebuild =
      previous.pointBudgetPreset !== this.visuals.pointBudgetPreset ||
      previous.maxPoints !== this.visuals.maxPoints;

    if (requiresRebuild && this.snapshot) {
      this.buildBudgetPlan();
      this.buildEntityCloud();
      this.buildRelationCloud();
      this.updateInteractionHighlights();
    } else if (previous.holarchyDepth !== this.visuals.holarchyDepth) {
      this.applyDrawRanges();
    }

    this.updateMaterialUniforms();
    this.updatePostProcessing();
    this.emitStats();
  }

  setSelection(selection?: SelectionOverlay) {
    this.selection = selection;
    this.updateInteractionHighlights();
  }

  setSnapshot(snapshot: FrameSnapshot) {
    this.snapshot = snapshot;
    this.buildRelationLookup();
    this.buildNestedLookup();
    this.updateWorldGrounding();
    this.buildBudgetPlan();
    this.buildEntityCloud();
    this.buildRelationCloud();
    this.updateInteractionHighlights();
  }

  pick(clientX: number, clientY: number) {
    this.onPick?.(this.resolveSelectionAt(clientX, clientY));
  }

  hover(clientX: number, clientY: number) {
    const selection = this.resolveSelectionAt(clientX, clientY);
    this.setHoveredSelection(selection);
    this.onHover?.(selection);
  }

  clearHover() {
    this.setHoveredSelection(undefined);
    this.onHover?.(undefined);
  }

  private disposePoints(points?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>) {
    if (!points) {
      return;
    }

    points.geometry.dispose();
  }

  private disposeLineSegments(lines?: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>) {
    if (!lines) {
      return;
    }

    lines.geometry.dispose();
    lines.material.dispose();
  }

  private startLoop() {
    const tick = (time: number) => {
      this.frameHandle = requestFrame(tick);
      this.lastTimeSeconds = time * 0.001;
      this.updateCamera();
      this.updateMaterialUniforms();
      if (this.composer && this.postProcessingEnabled()) {
        this.composer.render();
      } else {
        this.renderer?.render(this.scene, this.camera);
      }
    };

    this.frameHandle = requestFrame(tick);
  }

  private updateCamera() {
    const { position, yaw, pitch } = this.currentCamera;
    this.camera.position.set(position[0], position[1], position[2]);

    const direction = new THREE.Vector3(
      Math.cos(pitch) * Math.cos(yaw),
      Math.cos(pitch) * Math.sin(yaw),
      Math.sin(pitch)
    );

    this.camera.lookAt(this.camera.position.clone().add(direction));
  }

  private buildBudgetPlan() {
    if (!this.snapshot) {
      return;
    }

    const entityWeights = this.snapshot.anchorIds.map((_, index) => pointWeightForAnchor(this.snapshot!, index));
    const relationWeights = this.snapshot.relationIds.map((_, index) => pointWeightForRelation(this.snapshot!, index));
    const requestedEntityPoints = this.snapshot.anchorIds.reduce(
      (sum, _, index) => sum + requestedPointCountForAnchor(this.snapshot!, index),
      0
    );
    const requestedRelationPoints = this.snapshot.relationIds.reduce(
      (sum, _, index) => sum + requestedPointCountForRelation(this.snapshot!, index),
      0
    );
    const pointBudget = resolvePointBudget(this.visuals.pointBudgetPreset, this.visuals.maxPoints);
    const allocation = allocatePointBudget(pointBudget, requestedEntityPoints, requestedRelationPoints);
    const entityCounts = allocateWeightedCounts(entityWeights, allocation.entityPoints, Math.min(24, Math.max(4, this.snapshot.anchorIds.length ? Math.floor(allocation.entityPoints / this.snapshot.anchorIds.length / 2) : 0)));
    const relationCounts = allocateWeightedCounts(relationWeights, allocation.relationPoints, Math.min(18, Math.max(2, this.snapshot.relationIds.length ? Math.floor(allocation.relationPoints / this.snapshot.relationIds.length / 2) : 0)));

    this.budgetPlan = {
      droppedPoints: allocation.droppedPoints,
      entityCounts,
      entityTotal: entityCounts.reduce((sum, count) => sum + count, 0),
      relationCounts,
      relationTotal: relationCounts.reduce((sum, count) => sum + count, 0)
    };
  }

  private buildEntityCloud() {
    if (!this.snapshot || !this.budgetPlan || !this.entityMaterials) {
      return;
    }

    this.disposePoints(this.entityPoints);
    this.disposePoints(this.entityHalo);
    this.entityGroup.clear();
    this.entityPointAnchorIds = [];

    const positions = new Float32Array(this.budgetPlan.entityTotal * 3);
    const colors = new Float32Array(this.budgetPlan.entityTotal * 3);
    const sizes = new Float32Array(this.budgetPlan.entityTotal);
    const alphas = new Float32Array(this.budgetPlan.entityTotal);
    const anchorIndices = new Float32Array(this.budgetPlan.entityTotal);
    const pointOrder = buildInterleavedIndexOrder(this.budgetPlan.entityCounts);
    const pointLevels = new Int32Array(this.snapshot.anchorIds.length);
    const sizeVector = new THREE.Vector3();

    for (let cursor = 0; cursor < pointOrder.length; cursor += 1) {
      const anchorIndex = pointOrder[cursor]!;
      const pointLevel = pointLevels[anchorIndex]!;
      pointLevels[anchorIndex] += 1;
      const anchorId = this.snapshot.anchorIds[anchorIndex]!;
      const positionIndex = anchorIndex * 3;
      sizeVector.set(
        this.snapshot.sizes[positionIndex]!,
        this.snapshot.sizes[positionIndex + 1]!,
        this.snapshot.sizes[positionIndex + 2]!
      );
      const center = new THREE.Vector3(
        this.snapshot.positions[positionIndex]!,
        this.snapshot.positions[positionIndex + 1]!,
        this.snapshot.positions[positionIndex + 2]! + sizeVector.z * 0.5
      );
      const next = mulberry32(hashString(`${anchorId}:${pointLevel}`));
      const offset = sampleAnchorPoint(
        this.snapshot.anchorEntityTypes[anchorIndex]!,
        this.snapshot.anchorKinds[anchorIndex]!,
        this.snapshot.anchorRenderClasses[anchorIndex]!,
        sizeVector,
        next
      );
      const worldPoint = center.add(offset);
      const tint = 0.88 + next() * 0.24;
      const jitter = (next() - 0.5) * 0.08;

      positions[cursor * 3] = worldPoint.x;
      positions[cursor * 3 + 1] = worldPoint.y;
      positions[cursor * 3 + 2] = worldPoint.z;
      colors[cursor * 3] = clamp((this.snapshot.colors[positionIndex] ?? 0.7) * tint, 0, 1);
      colors[cursor * 3 + 1] = clamp((this.snapshot.colors[positionIndex + 1] ?? 0.7) * tint, 0, 1);
      colors[cursor * 3 + 2] = clamp((this.snapshot.colors[positionIndex + 2] ?? 0.7) * tint, 0, 1);
      sizes[cursor] = pointSizeForAnchor(this.snapshot, anchorIndex) + jitter;
      alphas[cursor] = pointAlphaForAnchor(this.snapshot, anchorIndex);
      anchorIndices[cursor] = anchorIndex;
      this.entityPointAnchorIds.push(anchorId);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aAnchorIndex', new THREE.BufferAttribute(anchorIndices, 1).setUsage(THREE.StaticDrawUsage));
    geometry.computeBoundingSphere();

    this.entityPoints = new THREE.Points(geometry, this.entityMaterials.core);
    this.entityPoints.frustumCulled = false;
    this.entityHalo = new THREE.Points(geometry, this.entityMaterials.halo);
    this.entityHalo.frustumCulled = false;
    this.entityGroup.add(this.entityHalo, this.entityPoints);
    this.applyDrawRanges();
    this.updateMaterialUniforms();
    this.pickableObjects = [
      ...(this.entityPoints ? [this.entityPoints] : []),
      ...(this.relationPickProxy ? [this.relationPickProxy] : [])
    ];
  }

  private buildRelationCloud() {
    if (!this.snapshot || !this.budgetPlan || !this.relationMaterials) {
      return;
    }

    this.disposePoints(this.relationPoints);
    this.disposeLineSegments(this.relationPickProxy);
    this.relationGroup.clear();
    this.pickGroup.clear();
    this.relationPointRelationIds = [];
    this.relationSegmentRelationIds = [];

    const positions = new Float32Array(this.budgetPlan.relationTotal * 3);
    const starts = new Float32Array(this.budgetPlan.relationTotal * 3);
    const ends = new Float32Array(this.budgetPlan.relationTotal * 3);
    const colors = new Float32Array(this.budgetPlan.relationTotal * 3);
    const endColors = new Float32Array(this.budgetPlan.relationTotal * 3);
    const phases = new Float32Array(this.budgetPlan.relationTotal);
    const lanes = new Float32Array(this.budgetPlan.relationTotal);
    const relationIndices = new Float32Array(this.budgetPlan.relationTotal);
    const styleIndices = new Float32Array(this.budgetPlan.relationTotal);
    const sizes = new Float32Array(this.budgetPlan.relationTotal);
    const pointOrder = buildInterleavedIndexOrder(this.budgetPlan.relationCounts);
    const pointLevels = new Int32Array(this.snapshot.relationIds.length);

    for (let cursor = 0; cursor < pointOrder.length; cursor += 1) {
      const relationIndex = pointOrder[cursor]!;
      const pointLevel = pointLevels[relationIndex]!;
      pointLevels[relationIndex] += 1;
      const relationId = this.snapshot.relationIds[relationIndex]!;
      const next = mulberry32(hashString(`${relationId}:${pointLevel}`));
      const startOffset = relationIndex * 6;
      const styleId = this.snapshot.relationStyleIds[relationIndex]!;
      const sourceAnchorIndex = this.snapshot.anchorIds.indexOf(this.snapshot.relationSourceAnchorIds[relationIndex]!);
      const targetAnchorIndex = this.snapshot.anchorIds.indexOf(this.snapshot.relationTargetAnchorIds[relationIndex]!);
      const sourceColorIndex = Math.max(0, sourceAnchorIndex) * 3;
      const targetColorIndex = Math.max(0, targetAnchorIndex) * 3;

      positions[cursor * 3] = this.snapshot.relationEndpoints[startOffset]!;
      positions[cursor * 3 + 1] = this.snapshot.relationEndpoints[startOffset + 1]!;
      positions[cursor * 3 + 2] = this.snapshot.relationEndpoints[startOffset + 2]!;
      starts[cursor * 3] = this.snapshot.relationEndpoints[startOffset]!;
      starts[cursor * 3 + 1] = this.snapshot.relationEndpoints[startOffset + 1]!;
      starts[cursor * 3 + 2] = this.snapshot.relationEndpoints[startOffset + 2]!;
      ends[cursor * 3] = this.snapshot.relationEndpoints[startOffset + 3]!;
      ends[cursor * 3 + 1] = this.snapshot.relationEndpoints[startOffset + 4]!;
      ends[cursor * 3 + 2] = this.snapshot.relationEndpoints[startOffset + 5]!;
      colors[cursor * 3] = this.snapshot.colors[sourceColorIndex] ?? 0.7;
      colors[cursor * 3 + 1] = this.snapshot.colors[sourceColorIndex + 1] ?? 0.7;
      colors[cursor * 3 + 2] = this.snapshot.colors[sourceColorIndex + 2] ?? 0.7;
      endColors[cursor * 3] = this.snapshot.colors[targetColorIndex] ?? 0.7;
      endColors[cursor * 3 + 1] = this.snapshot.colors[targetColorIndex + 1] ?? 0.7;
      endColors[cursor * 3 + 2] = this.snapshot.colors[targetColorIndex + 2] ?? 0.7;
      phases[cursor] = next();
      lanes[cursor] = (next() - 0.5) * 2;
      relationIndices[cursor] = relationIndex;
      styleIndices[cursor] = relationTrailStyleIndex(styleId);
      sizes[cursor] = 1.55 + next() * 0.55;
      this.relationPointRelationIds.push(relationId);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aStart', new THREE.BufferAttribute(starts, 3).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 3).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aEndColor', new THREE.BufferAttribute(endColors, 3).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aPhaseOffset', new THREE.BufferAttribute(phases, 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aLane', new THREE.BufferAttribute(lanes, 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aRelationIndex', new THREE.BufferAttribute(relationIndices, 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aStyleIndex', new THREE.BufferAttribute(styleIndices, 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.StaticDrawUsage));
    geometry.computeBoundingSphere();

    this.relationPoints = new THREE.Points(geometry, this.relationMaterials.cloud);
    this.relationPoints.frustumCulled = false;
    this.relationGroup.add(this.relationPoints);

    const pickPositions = new Float32Array(this.snapshot.relationIds.length * 6);
    this.snapshot.relationIds.forEach((relationId, index) => {
      const offset = index * 6;
      pickPositions[offset] = this.snapshot!.relationEndpoints[offset]!;
      pickPositions[offset + 1] = this.snapshot!.relationEndpoints[offset + 1]!;
      pickPositions[offset + 2] = this.snapshot!.relationEndpoints[offset + 2]!;
      pickPositions[offset + 3] = this.snapshot!.relationEndpoints[offset + 3]!;
      pickPositions[offset + 4] = this.snapshot!.relationEndpoints[offset + 4]!;
      pickPositions[offset + 5] = this.snapshot!.relationEndpoints[offset + 5]!;
      this.relationSegmentRelationIds.push(relationId);
    });

    const pickGeometry = new THREE.BufferGeometry();
    pickGeometry.setAttribute('position', new THREE.BufferAttribute(pickPositions, 3).setUsage(THREE.StaticDrawUsage));
    this.relationPickProxy = new THREE.LineSegments(
      pickGeometry,
      new THREE.LineBasicMaterial({
        color: '#ffffff',
        opacity: 0.001,
        transparent: true,
        depthWrite: false
      })
    );
    this.pickGroup.add(this.relationPickProxy);
    this.applyDrawRanges();
    this.updateMaterialUniforms();
    this.pickableObjects = [
      ...(this.entityPoints ? [this.entityPoints] : []),
      ...(this.relationPickProxy ? [this.relationPickProxy] : [])
    ];
  }

  private buildRelationLookup() {
    this.relationIdsByAnchorId.clear();
    this.relationEndpointsById.clear();

    if (!this.snapshot) {
      return;
    }

    this.snapshot.relationIds.forEach((relationId, index) => {
      const source = this.snapshot?.relationSourceAnchorIds[index];
      const target = this.snapshot?.relationTargetAnchorIds[index];

      if (!source || !target) {
        return;
      }

      this.relationEndpointsById.set(relationId, { source, target });
      this.addRelationToAnchor(source, relationId);
      this.addRelationToAnchor(target, relationId);
    });
  }

  private buildNestedLookup() {
    this.nestedAnchorIdsByAnchorId.clear();

    if (!this.snapshot || !this.bundle) {
      return;
    }

    const anchorIdsByEntityType = new Map<string, string[]>();

    this.snapshot.anchorEntityTypes.forEach((entityType, index) => {
      const anchorIds = anchorIdsByEntityType.get(entityType) ?? [];
      anchorIds.push(this.snapshot!.anchorIds[index]!);
      anchorIdsByEntityType.set(entityType, anchorIds);
    });

    this.bundle.nestedLinks.forEach((link) => {
      const parents = anchorIdsByEntityType.get(link.parent) ?? [];
      const children = anchorIdsByEntityType.get(link.child) ?? [];

      parents.forEach((parentId) => {
        children.forEach((childId) => {
          this.addNestedAnchor(parentId, childId);
          this.addNestedAnchor(childId, parentId);
        });
      });
    });
  }

  private updateWorldGrounding() {
    if (!this.snapshot) {
      return;
    }

    const [minX, minY, minZ, maxX, maxY] = this.snapshot.worldBounds;
    this.groundGrid.position.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, minZ);
  }

  private addRelationToAnchor(anchorId: string, relationId: string) {
    const existing = this.relationIdsByAnchorId.get(anchorId);

    if (existing) {
      existing.add(relationId);
      return;
    }

    this.relationIdsByAnchorId.set(anchorId, new Set([relationId]));
  }

  private addNestedAnchor(anchorId: string, relatedAnchorId: string) {
    const existing = this.nestedAnchorIdsByAnchorId.get(anchorId);

    if (existing) {
      existing.add(relatedAnchorId);
      return;
    }

    this.nestedAnchorIdsByAnchorId.set(anchorId, new Set([relatedAnchorId]));
  }

  private resolveSelectionAt(clientX: number, clientY: number) {
    if (!this.renderer) {
      return undefined;
    }

    this.pointer.set(clientX, clientY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickableObjects, false);
    const hit = hits[0];

    if (!hit || hit.index === undefined) {
      return undefined;
    }

    if (hit.object === this.entityPoints) {
      const anchorId = this.entityPointAnchorIds[hit.index];
      return anchorId ? { kind: 'anchor' as const, id: anchorId } : undefined;
    }

    if (hit.object === this.relationPickProxy) {
      const relationId = this.relationSegmentRelationIds[Math.floor(hit.index / 2)];
      return relationId ? { kind: 'relation' as const, id: relationId } : undefined;
    }

    return undefined;
  }

  private setHoveredSelection(selection?: { kind: 'anchor' | 'relation'; id: string }) {
    if (this.hoveredSelection?.id === selection?.id && this.hoveredSelection?.kind === selection?.kind) {
      return;
    }

    this.hoveredSelection = selection;
    this.updateInteractionHighlights();
  }

  private buildHighlightState(): HighlightState {
    const anchorLevels = new Map<string, number>();
    const relationLevels = new Map<string, number>();
    const applyInteraction = (
      interaction: { kind: 'anchor' | 'relation'; id: string } | undefined,
      level: number
    ) => {
      if (!interaction) {
        return;
      }

      if (interaction.kind === 'anchor') {
        this.bumpLevel(anchorLevels, interaction.id, level);
        for (const relationId of this.relationIdsByAnchorId.get(interaction.id) ?? []) {
          this.bumpLevel(relationLevels, relationId, Math.max(1, level - 1));
        }
        for (const nestedAnchorId of this.nestedAnchorIdsByAnchorId.get(interaction.id) ?? []) {
          this.bumpLevel(anchorLevels, nestedAnchorId, 1);
        }
        return;
      }

      this.bumpLevel(relationLevels, interaction.id, level);
      const endpoints = this.relationEndpointsById.get(interaction.id);

      if (!endpoints) {
        return;
      }

      this.bumpLevel(anchorLevels, endpoints.source, Math.max(1, level - 1));
      this.bumpLevel(anchorLevels, endpoints.target, Math.max(1, level - 1));
    };

    applyInteraction(this.selection ? { kind: this.selection.kind, id: this.selection.id } : undefined, 3);
    applyInteraction(this.hoveredSelection, 2);

    return {
      active: anchorLevels.size > 0 || relationLevels.size > 0,
      anchorLevels,
      relationLevels
    };
  }

  private bumpLevel(target: Map<string, number>, id: string, level: number) {
    target.set(id, Math.max(target.get(id) ?? 0, level));
  }

  private updateInteractionHighlights() {
    this.highlightState = this.buildHighlightState();
    this.updateStateTextures();
    this.updateMaterialUniforms();
    this.emitStats();
  }

  private updateStateTextures() {
    if (!this.snapshot) {
      return;
    }

    this.anchorState = ensureStateTexture(this.anchorState, this.snapshot.anchorIds.length);
    this.relationState = ensureStateTexture(this.relationState, this.snapshot.relationIds.length);
    this.anchorState.array.fill(0);
    this.relationState.array.fill(0);

    this.snapshot.anchorIds.forEach((anchorId, index) => {
      const level = this.highlightState.anchorLevels.get(anchorId) ?? 0;
      const offset = index * 4;
      this.anchorState!.array[offset] = level;
      this.anchorState!.array[offset + 1] = this.highlightState.active
        ? level === 3
          ? 1
          : level === 2
            ? 0.92
            : level === 1
              ? 0.74
              : 0.34
        : 1;
      this.anchorState!.array[offset + 2] = level === 3 ? 1.42 : level === 2 ? 1.24 : level === 1 ? 1.12 : 1;
      this.anchorState!.array[offset + 3] = level === 3 ? 1 : level === 2 ? 0.76 : level === 1 ? 0.46 : 0.18;
    });

    this.snapshot.relationIds.forEach((relationId, index) => {
      const level = this.highlightState.relationLevels.get(relationId) ?? 0;
      const offset = index * 4;
      this.relationState!.array[offset] = level;
      this.relationState!.array[offset + 1] = this.highlightState.active
        ? level === 3
          ? 1
          : level === 2
            ? 0.92
            : level === 1
              ? 0.74
              : 0.22
        : 0.86;
      this.relationState!.array[offset + 2] = level === 3 ? 1.45 : level === 2 ? 1.26 : level === 1 ? 1.12 : 1;
      this.relationState!.array[offset + 3] = level === 3 ? 1 : level === 2 ? 0.82 : level === 1 ? 0.52 : 0.2;
    });

    this.anchorState.texture.needsUpdate = true;
    this.relationState.texture.needsUpdate = true;
  }

  private updateMaterialUniforms() {
    if (!this.capabilities) {
      return;
    }

    const viewport = new THREE.Vector2(this.width, this.height);
    const pointSizeLimit = clampPointSizeToRange(
      this.visuals.transparencyMode === 'soft_alpha' ? this.capabilities.aliasedPointSizeRange[1] * 0.8 : this.capabilities.aliasedPointSizeRange[1],
      this.capabilities.aliasedPointSizeRange
    );

    this.applyUniformsToMaterial(this.entityMaterials?.core, {
      stateTexture: this.anchorState?.texture,
      stateResolution: this.snapshot?.anchorIds.length ?? 1,
      viewport,
      pointSizeLimit,
      softAlpha: this.visuals.transparencyMode === 'soft_alpha',
      dofEnabled: this.visuals.dofMode !== 'off',
      glowEnabled: this.visuals.glowMode !== 'off',
      focusDistance: this.visuals.focusDistance
    });
    this.applyUniformsToMaterial(this.entityMaterials?.halo, {
      stateTexture: this.anchorState?.texture,
      stateResolution: this.snapshot?.anchorIds.length ?? 1,
      viewport,
      pointSizeLimit,
      softAlpha: this.visuals.transparencyMode === 'soft_alpha',
      dofEnabled: this.visuals.dofMode !== 'off',
      glowEnabled: this.visuals.glowMode !== 'off',
      focusDistance: this.visuals.focusDistance
    });
    this.applyUniformsToMaterial(this.relationMaterials?.cloud, {
      stateTexture: this.relationState?.texture,
      stateResolution: this.snapshot?.relationIds.length ?? 1,
      viewport,
      pointSizeLimit,
      softAlpha: true,
      dofEnabled: this.visuals.dofMode !== 'off',
      glowEnabled: this.visuals.glowMode !== 'off',
      focusDistance: this.visuals.focusDistance
    });

    if (this.entityMaterials) {
      this.entityMaterials.core.depthWrite = this.visuals.transparencyMode === 'solid_core';
      this.entityMaterials.core.alphaToCoverage = this.visuals.transparencyMode === 'solid_core';
      if (this.entityHalo) {
        this.entityHalo.visible = this.visuals.glowMode !== 'off';
      }
    }

    if (this.relationMaterials) {
      this.relationMaterials.cloud.uniforms.uTime.value = this.lastTimeSeconds;
    }

    if (this.bokehPass) {
      const bokehUniforms = this.bokehPass.uniforms as Record<string, { value: number }>;
      bokehUniforms.focus.value = Math.max(1, this.visuals.focusDistance);
      bokehUniforms.aperture.value = this.visuals.dofMode === 'bokeh' ? 0.0024 : 0.00001;
      bokehUniforms.maxblur.value = this.visuals.dofMode === 'bokeh' ? 0.012 : 0.0;
    }

    if (this.bloomPass) {
      this.bloomPass.enabled = this.visuals.glowMode === 'bloom' && this.postProcessingEnabled();
      this.bloomPass.strength = this.visuals.glowMode === 'bloom' ? 0.84 : 0;
      this.bloomPass.radius = 0.22;
      this.bloomPass.threshold = 0.42;
    }
  }

  private applyUniformsToMaterial(
    material: THREE.ShaderMaterial | undefined,
    config: {
      dofEnabled: boolean;
      focusDistance: number;
      glowEnabled: boolean;
      pointSizeLimit: number;
      softAlpha: boolean;
      stateResolution: number;
      stateTexture?: THREE.Texture;
      viewport: THREE.Vector2;
    }
  ) {
    if (!material) {
      return;
    }

    material.uniforms.uStateTexture.value = config.stateTexture ?? null;
    material.uniforms.uStateResolution.value = Math.max(1, config.stateResolution);
    material.uniforms.uViewportHeight.value = config.viewport.y;
    material.uniforms.uMaxPointSize.value = config.pointSizeLimit;
    material.uniforms.uFocusDistance.value = Math.max(1, config.focusDistance);
    material.uniforms.uDofEnabled.value = config.dofEnabled ? 1 : 0;
    material.uniforms.uDofStrength.value = this.visuals.dofMode === 'bokeh' ? 1.6 : 1.1;
    material.uniforms.uSoftAlpha.value = config.softAlpha ? 1 : 0;
    material.uniforms.uGlowEnabled.value = config.glowEnabled ? 1 : 0;
    material.uniforms.uHasHighlights.value = this.highlightState.active ? 1 : 0;
    material.uniforms.uTime.value = this.lastTimeSeconds;
  }

  private applyDrawRanges() {
    if (!this.budgetPlan) {
      return;
    }

    if (this.entityPoints) {
      const visible = visiblePointCount(this.budgetPlan.entityTotal, this.visuals.holarchyDepth, this.snapshot?.anchorIds.length ?? 0);
      this.entityPoints.geometry.setDrawRange(0, visible);
      this.entityHalo?.geometry.setDrawRange(0, visible);
    }

    if (this.relationPoints) {
      const visible = visiblePointCount(this.budgetPlan.relationTotal, this.visuals.holarchyDepth, this.snapshot?.relationIds.length ?? 0);
      this.relationPoints.geometry.setDrawRange(0, visible);
    }
  }

  private postProcessingEnabled() {
    return Boolean(
      this.renderer &&
      this.capabilities &&
      resolvePointBudget(this.visuals.pointBudgetPreset, this.visuals.maxPoints) <= pointBudgetCaps.balanced &&
      (this.visuals.dofMode === 'bokeh' || this.visuals.glowMode === 'bloom')
    );
  }

  private updatePostProcessing() {
    if (!this.renderer) {
      return;
    }

    if (!this.postProcessingEnabled()) {
      this.renderPass = undefined;
      this.bokehPass = undefined;
      this.bloomPass = undefined;
      this.composer?.dispose();
      this.composer = undefined;
      return;
    }

    if (!this.composer) {
      this.composer = new EffectComposer(this.renderer);
      this.renderPass = new RenderPass(this.scene, this.camera);
      this.bokehPass = new BokehPass(this.scene, this.camera, {
        focus: this.visuals.focusDistance,
        aperture: 0.0024,
        maxblur: 0.012
      });
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(this.width * 0.5, this.height * 0.5), 0.84, 0.22, 0.42);
      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.bokehPass);
      this.composer.addPass(this.bloomPass);
    }

    if (this.bokehPass) {
      this.bokehPass.enabled = this.visuals.dofMode === 'bokeh';
    }

    if (this.bloomPass) {
      this.bloomPass.enabled = this.visuals.glowMode === 'bloom';
    }
  }

  private emitStats() {
    const entityRendered = this.entityPoints?.geometry.drawRange.count ?? 0;
    const relationRendered = this.relationPoints?.geometry.drawRange.count ?? 0;

    this.onStats?.({
      backend: this.runtimeBackend === 'worker' ? this.capabilities?.backend ?? 'webgl' : 'main-thread',
      pointBudgetPreset: this.visuals.pointBudgetPreset,
      maxPoints: this.visuals.maxPoints,
      renderedEntityPoints: entityRendered,
      renderedRelationPoints: relationRendered,
      droppedPoints: this.budgetPlan?.droppedPoints ?? 0,
      dofMode: this.visuals.dofMode,
      glowMode: this.visuals.glowMode,
      transparencyMode: this.visuals.transparencyMode,
      postProcessingActive: this.postProcessingEnabled()
    });
  }
}

function relationTrailStyleIndex(styleId: RelationTrailStyleId) {
  switch (styleId) {
    case 'resource_flow':
      return 0;
    case 'signal_plume':
      return 1;
    case 'occupancy_tether':
      return 2;
    case 'predation_arc':
      return 3;
    case 'mycelial_diffuse_star':
      return 4;
    case 'fire_front':
      return 5;
    default:
      return 0;
  }
}
