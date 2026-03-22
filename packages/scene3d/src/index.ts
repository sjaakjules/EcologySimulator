import * as THREE from 'three';

import {
  relationTrailStyles,
  type CameraState,
  type FrameSnapshot,
  type RelationTrailStyleId,
  type SelectionOverlay
} from '@ecology/domain';
import type { NormalizedBundle } from '@ecology/schema';

type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;

interface BasicRenderer {
  dispose?: () => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  setPixelRatio: (ratio: number) => void;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
}

interface RendererInit {
  backend: 'webgpu' | 'webgl';
  renderer: BasicRenderer;
}

interface DynamicTrail {
  baseColor: THREE.Color;
  baseSize: number;
  curve: THREE.Curve<THREE.Vector3>;
  points: THREE.Points;
  relationId: string;
  sampleCount: number;
  styleId: RelationTrailStyleId;
}

interface HighlightState {
  anchorLevels: Map<string, number>;
  relationLevels: Map<string, number>;
}

interface SemanticPartDescriptor {
  color: THREE.ColorRepresentation;
  offset: THREE.Vector3;
  size: THREE.Vector3;
}

interface SemanticAnchorDetail {
  overlay?: SemanticPartDescriptor;
  parts: SemanticPartDescriptor[];
}

function makeTransparentVoxelMaterial(color: THREE.ColorRepresentation) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: '#000000',
    roughness: 0.24,
    metalness: 0.04,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });
}

function makeTransparentVoxelObject(
  size: THREE.Vector3,
  color: THREE.Color,
  selection: { kind: 'anchor' | 'relation'; id: string }
) {
  const geometry = new THREE.BoxGeometry(Math.max(0.3, size.x), Math.max(0.3, size.y), Math.max(0.3, size.z));
  const mesh = new THREE.Mesh(geometry, makeTransparentVoxelMaterial(color));
  mesh.userData.baseColor = color.clone();
  mesh.userData.role = 'surface';
  mesh.userData.selection = selection;
  mesh.renderOrder = 1;

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: color.clone().lerp(new THREE.Color('#ffffff'), 0.28),
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  edges.userData.baseColor = color.clone();
  edges.userData.role = 'edges';
  edges.userData.selection = selection;
  edges.visible = false;
  edges.renderOrder = 2;

  return { mesh, edges };
}

function parameterNumber(bundle: NormalizedBundle | undefined, entityType: string, key: string) {
  const value = bundle?.entityIndex[entityType]?.parameters[key]?.default;
  return typeof value === 'number' ? value : undefined;
}

function clampSize(value: number, min: number, max: number) {
  return THREE.MathUtils.clamp(value, min, max);
}

function describeSemanticAnchorDetail(
  bundle: NormalizedBundle | undefined,
  entityType: string,
  size: THREE.Vector3,
  inspectMode: boolean
): SemanticAnchorDetail | undefined {
  switch (entityType) {
    case 'LargeOldEucalyptTree': {
      const crownRadius = parameterNumber(bundle, entityType, 'crown_radius_m') ?? Math.max(size.x, size.y) * 5;
      const crownWidth = clampSize(crownRadius * 1.8, 10, 42);

      return {
        overlay: {
          color: '#6e9f62',
          offset: new THREE.Vector3(0, 0, size.z * 0.84),
          size: new THREE.Vector3(crownWidth, crownWidth, clampSize(size.z * 0.24, 8, 18))
        },
        parts: [
          {
            color: '#9b8667',
            offset: new THREE.Vector3(size.x * 0.72, 0, size.z * 0.08),
            size: new THREE.Vector3(clampSize(size.x * 0.85, 0.8, 1.8), clampSize(size.y * 0.45, 0.45, 0.9), clampSize(size.z * 0.14, 2.2, 5.5))
          },
          {
            color: '#9b8667',
            offset: new THREE.Vector3(-size.x * 0.68, size.y * 0.18, size.z * 0.08),
            size: new THREE.Vector3(clampSize(size.x * 0.78, 0.8, 1.7), clampSize(size.y * 0.4, 0.45, 0.9), clampSize(size.z * 0.12, 2, 5))
          },
          {
            color: '#d6c79e',
            offset: new THREE.Vector3(size.x * 0.74, 0, size.z * 0.46),
            size: new THREE.Vector3(clampSize(size.x * 0.38, 0.45, 0.95), clampSize(size.y * 0.32, 0.35, 0.8), clampSize(size.z * 0.05, 1.6, 3.2))
          },
          {
            color: '#b69065',
            offset: new THREE.Vector3(-size.x * 0.82, size.y * 0.1, size.z * 0.62),
            size: new THREE.Vector3(0.36, 0.28, clampSize(size.z * 0.22, 4, 12))
          },
          ...(inspectMode
            ? [
                {
                  color: '#d46f43',
                  offset: new THREE.Vector3(size.x * 0.52, -size.y * 0.26, size.z * 0.24),
                  size: new THREE.Vector3(clampSize(size.x * 0.28, 0.4, 0.8), clampSize(size.y * 0.24, 0.3, 0.7), clampSize(size.z * 0.1, 1.2, 3.4))
                }
              ]
            : [])
        ]
      };
    }
    case 'StandingDeadTree':
      return {
        parts: [
          {
            color: '#a59074',
            offset: new THREE.Vector3(0, 0, size.z * 0.72),
            size: new THREE.Vector3(clampSize(size.x * 0.62, 0.6, 1.2), clampSize(size.y * 0.62, 0.6, 1.2), clampSize(size.z * 0.22, 4, 10))
          },
          {
            color: '#d2c29d',
            offset: new THREE.Vector3(size.x * 0.54, 0, size.z * 0.45),
            size: new THREE.Vector3(clampSize(size.x * 0.36, 0.4, 0.8), clampSize(size.y * 0.28, 0.3, 0.7), clampSize(size.z * 0.07, 1.6, 3.4))
          },
          {
            color: '#8d7b61',
            offset: new THREE.Vector3(0, -size.y * 0.48, size.z * 0.8),
            size: new THREE.Vector3(clampSize(size.x * 0.8, 0.8, 1.6), 0.28, clampSize(size.z * 0.025, 0.45, 0.9))
          }
        ]
      };
    case 'FallenLog':
      return {
        parts: [
          {
            color: '#8a6b4e',
            offset: new THREE.Vector3(-size.x * 0.24, 0, size.z * 0.52),
            size: new THREE.Vector3(clampSize(size.x * 0.26, 1.4, 3.4), clampSize(size.y * 0.88, 0.5, 1.2), clampSize(size.z * 0.72, 0.35, 1))
          },
          {
            color: '#8a6b4e',
            offset: new THREE.Vector3(0, 0, size.z * 0.52),
            size: new THREE.Vector3(clampSize(size.x * 0.24, 1.3, 3.1), clampSize(size.y * 0.82, 0.5, 1.1), clampSize(size.z * 0.68, 0.35, 0.95))
          },
          {
            color: '#8a6b4e',
            offset: new THREE.Vector3(size.x * 0.24, 0, size.z * 0.5),
            size: new THREE.Vector3(clampSize(size.x * 0.22, 1.2, 2.8), clampSize(size.y * 0.78, 0.48, 1), clampSize(size.z * 0.62, 0.32, 0.9))
          },
          ...(inspectMode
            ? [
                {
                  color: '#7ea06a',
                  offset: new THREE.Vector3(0, 0, size.z * 0.96),
                  size: new THREE.Vector3(clampSize(size.x * 0.18, 0.8, 2.2), clampSize(size.y * 0.46, 0.3, 0.7), clampSize(size.z * 0.45, 0.24, 0.55))
                }
              ]
            : [])
        ]
      };
    case 'TreeFernGuild':
      return {
        overlay: {
          color: '#5b8e5a',
          offset: new THREE.Vector3(0, 0, size.z * 0.9),
          size: new THREE.Vector3(clampSize(size.x * 2.1, 2.8, 5.2), clampSize(size.y * 2.1, 2.8, 5.2), clampSize(size.z * 0.18, 1.2, 2))
        },
        parts: [
          {
            color: '#83674d',
            offset: new THREE.Vector3(0, 0, size.z * 0.46),
            size: new THREE.Vector3(clampSize(size.x * 0.34, 0.4, 0.9), clampSize(size.y * 0.34, 0.4, 0.9), clampSize(size.z * 0.72, 2.2, 4.2))
          },
          {
            color: '#6ea76a',
            offset: new THREE.Vector3(size.x * 0.58, 0, size.z * 0.92),
            size: new THREE.Vector3(clampSize(size.x * 0.52, 0.6, 1.2), clampSize(size.y * 0.28, 0.25, 0.5), clampSize(size.z * 0.08, 0.4, 0.8))
          },
          {
            color: '#6ea76a',
            offset: new THREE.Vector3(-size.x * 0.4, size.y * 0.36, size.z * 0.9),
            size: new THREE.Vector3(clampSize(size.x * 0.48, 0.55, 1.1), clampSize(size.y * 0.26, 0.25, 0.5), clampSize(size.z * 0.08, 0.4, 0.8))
          }
        ]
      };
    case 'HollowCavity':
      return {
        parts: [
          {
            color: '#d9c79d',
            offset: new THREE.Vector3(size.x * 0.5, 0, size.z * 0.34),
            size: new THREE.Vector3(clampSize(size.x * 0.32, 0.3, 0.6), clampSize(size.y * 0.24, 0.24, 0.55), clampSize(size.z * 0.22, 0.3, 0.7))
          },
          {
            color: '#8d6d4f',
            offset: new THREE.Vector3(0, 0, size.z * 0.36),
            size: new THREE.Vector3(clampSize(size.x * 0.54, 0.4, 0.9), clampSize(size.y * 0.54, 0.4, 0.9), clampSize(size.z * 0.46, 0.38, 0.9))
          }
        ]
      };
    default:
      return undefined;
  }
}

function makeCurve(
  styleId: RelationTrailStyleId,
  start: THREE.Vector3,
  end: THREE.Vector3
): THREE.Curve<THREE.Vector3> {
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const distance = start.distanceTo(end);
  const lift = Math.max(1.5, distance * 0.16);

  switch (styleId) {
    case 'resource_flow':
      return new THREE.QuadraticBezierCurve3(
        start,
        midpoint.clone().add(new THREE.Vector3(0, 0, lift)),
        end
      );
    case 'signal_plume':
      return new THREE.CubicBezierCurve3(
        start,
        midpoint.clone().add(new THREE.Vector3(distance * 0.15, -distance * 0.1, lift * 1.4)),
        midpoint.clone().add(new THREE.Vector3(-distance * 0.1, distance * 0.12, lift * 0.8)),
        end
      );
    case 'occupancy_tether':
      return new THREE.CatmullRomCurve3([
        start,
        start.clone().lerp(end, 0.35).add(new THREE.Vector3(0, 0, lift * 0.4)),
        end.clone().lerp(start, 0.2).add(new THREE.Vector3(0, 0, lift * 0.2)),
        end
      ]);
    case 'predation_arc':
      return new THREE.CatmullRomCurve3([start, midpoint.clone().add(new THREE.Vector3(0, 0, lift * 1.8)), end]);
    case 'mycelial_diffuse_star':
      return new THREE.CatmullRomCurve3([
        start,
        midpoint.clone().add(new THREE.Vector3(distance * 0.12, distance * 0.12, lift * 0.2)),
        midpoint.clone().add(new THREE.Vector3(-distance * 0.14, -distance * 0.08, lift * 0.35)),
        end
      ]);
    case 'fire_front':
      return new THREE.CatmullRomCurve3([
        start,
        start.clone().lerp(end, 0.25).add(new THREE.Vector3(0, 0, lift * 0.1)),
        end.clone().lerp(start, 0.2).add(new THREE.Vector3(0, 0, lift * 0.1)),
        end
      ]);
    default:
      return new THREE.LineCurve3(start, end);
  }
}

async function createRenderer(canvas: RenderCanvas, width: number, height: number, dpr: number) {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  if (nav && 'gpu' in nav) {
    try {
      const module = (await import('three/webgpu')) as unknown as {
        WebGPURenderer: new (config: Record<string, unknown>) => BasicRenderer & { init?: () => Promise<void> };
      };
      const renderer = new module.WebGPURenderer({ antialias: true, canvas });
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      if (typeof renderer.init === 'function') {
        await renderer.init();
      }
      return { backend: 'webgpu', renderer } satisfies RendererInit;
    } catch {
      // Fall through to WebGL.
    }
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas, alpha: true });
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  return { backend: 'webgl', renderer } satisfies RendererInit;
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

export class EcologySceneRuntime {
  private renderer?: BasicRenderer;

  private backend: 'webgpu' | 'webgl' = 'webgl';

  private readonly scene = new THREE.Scene();

  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1000);

  private readonly farPointsGroup = new THREE.Group();

  private readonly midGroup = new THREE.Group();

  private readonly nearGroup = new THREE.Group();

  private readonly relationGroup = new THREE.Group();

  private readonly worldCenter = new THREE.Vector3(50, 50, 14);

  private frameHandle = 0;

  private lastZoomMode = '';

  private holarchyDepth = 0.48;

  private bundle?: NormalizedBundle;

  private snapshot?: FrameSnapshot;

  private selection?: SelectionOverlay;

  private hoveredSelection?: { kind: 'anchor' | 'relation'; id: string };

  private farPoints?: THREE.Points;

  private midMesh?: THREE.InstancedMesh;

  private pickableObjects: THREE.Object3D[] = [];

  private dynamicTrails: DynamicTrail[] = [];

  private readonly relationIdsByAnchorId = new Map<string, Set<string>>();

  private readonly relationEndpointsById = new Map<string, { source: string; target: string }>();

  private currentCamera: CameraState = {
    position: [146, 18, 74],
    yaw: 2.84,
    pitch: -0.55
  };

  private readonly raycaster = new THREE.Raycaster();

  private readonly pointer = new THREE.Vector2();

  constructor(
    private readonly canvas: RenderCanvas,
    private readonly onPick?: (selection?: { kind: 'anchor' | 'relation'; id: string }) => void,
    private readonly onReady?: (backend: 'webgpu' | 'webgl') => void,
    private readonly onHover?: (selection?: { kind: 'anchor' | 'relation'; id: string }) => void
  ) {
    this.scene.background = new THREE.Color('#081312');
    this.scene.fog = new THREE.Fog('#081312', 120, 260);
    this.camera.up.set(0, 0, 1);

    const ambient = new THREE.HemisphereLight('#dce9d6', '#132419', 1.15);
    const sun = new THREE.DirectionalLight('#ffe3af', 1.3);
    sun.position.set(60, -80, 120);
    const fill = new THREE.DirectionalLight('#86b4b0', 0.55);
    fill.position.set(-50, 60, 40);
    const groundGrid = new THREE.GridHelper(220, 22, '#335f55', '#18342f');
    groundGrid.rotateX(Math.PI / 2);
    groundGrid.position.set(50, 50, 0);
    const gridMaterial = Array.isArray(groundGrid.material) ? groundGrid.material : [groundGrid.material];
    gridMaterial.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.28;
    });

    this.scene.add(ambient, sun, fill, groundGrid, this.farPointsGroup, this.midGroup, this.nearGroup, this.relationGroup);
    this.camera.position.fromArray(this.currentCamera.position);
  }

  async init(width: number, height: number, dpr: number) {
    const { backend, renderer } = await createRenderer(this.canvas, width, height, dpr);
    this.renderer = renderer;
    this.backend = backend;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.onReady?.(backend);
    this.startLoop();
  }

  dispose() {
    if (this.frameHandle) {
      cancelFrame(this.frameHandle);
      this.frameHandle = 0;
    }

    this.dynamicTrails.forEach((trail) => {
      trail.points.geometry.dispose();
      (trail.points.material as THREE.Material).dispose();
    });

    this.farPoints?.geometry.dispose();
    (this.farPoints?.material as THREE.Material | undefined)?.dispose();
    this.midMesh?.geometry.dispose();
    const midMaterial = this.midMesh?.material;
    if (Array.isArray(midMaterial)) {
      midMaterial.forEach((material) => material.dispose());
    } else {
      midMaterial?.dispose();
    }

    this.renderer?.dispose?.();
  }

  resize(width: number, height: number, dpr: number) {
    if (!this.renderer) {
      return;
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
  }

  setBundle(bundle: NormalizedBundle) {
    this.bundle = bundle;
  }

  setCamera(camera: CameraState) {
    this.currentCamera = camera;

    if (this.nearGroup.visible) {
      this.rebuildNearGroup();
    } else {
      this.updateInteractionHighlights();
    }
  }

  setVisuals(visuals: { holarchyDepth: number }) {
    this.holarchyDepth = THREE.MathUtils.clamp(visuals.holarchyDepth, 0, 1);
    this.updateZoomMode(true);
  }

  setSelection(selection?: SelectionOverlay) {
    this.selection = selection;
    this.updateZoomMode(true);
    this.updateInteractionHighlights();
  }

  setSnapshot(snapshot: FrameSnapshot) {
    this.snapshot = snapshot;
    this.buildRelationLookup();
    this.buildFarPoints();
    this.buildMidInstances();
    this.buildRelations();
    this.updateZoomMode(true);
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

  private startLoop() {
    const tick = (time: number) => {
      this.frameHandle = requestFrame(tick);
      this.updateCamera();
      this.updateTrails(time * 0.001);
      this.renderer?.render(this.scene, this.camera);
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

  private updateZoomMode(force = false) {
    const mode =
      this.holarchyDepth > 0.82 ? 'inspect' : this.holarchyDepth > 0.56 ? 'near' : this.holarchyDepth > 0.22 ? 'mid' : 'far';
    const showNear = this.holarchyDepth > 0.38 || Boolean(this.selection || this.hoveredSelection);
    const showFarPoints = this.holarchyDepth < 0.16;
    const modeChanged = mode !== this.lastZoomMode;

    this.lastZoomMode = mode;
    this.farPointsGroup.visible = showFarPoints;
    this.midGroup.visible = true;
    this.nearGroup.visible = showNear;

    if (force || modeChanged || showNear) {
      this.rebuildNearGroup();
    }
  }

  private buildFarPoints() {
    if (!this.snapshot) {
      return;
    }

    this.farPointsGroup.clear();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.snapshot.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.snapshot.colors, 3));
    const material = new THREE.PointsMaterial({
      size: 4.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      sizeAttenuation: true
    });
    this.farPoints = new THREE.Points(geometry, material);
    this.farPoints.frustumCulled = false;
    this.farPointsGroup.add(this.farPoints);
  }

  private buildMidInstances() {
    if (!this.snapshot) {
      return;
    }

    const snapshot = this.snapshot;
    this.midGroup.clear();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = makeTransparentVoxelMaterial('#91d2b8');
    material.vertexColors = true;
    material.opacity = 0.14;
    const mesh = new THREE.InstancedMesh(geometry, material, snapshot.anchorIds.length);
    mesh.frustumCulled = false;
    const color = new THREE.Color();
    const matrix = new THREE.Matrix4();

    snapshot.anchorIds.forEach((_, index) => {
      const px = snapshot.positions[index * 3]!;
      const py = snapshot.positions[index * 3 + 1]!;
      const pz = snapshot.positions[index * 3 + 2]!;
      const sx = snapshot.sizes[index * 3]!;
      const sy = snapshot.sizes[index * 3 + 1]!;
      const sz = snapshot.sizes[index * 3 + 2]!;

      matrix.compose(
        new THREE.Vector3(px, py, pz + sz / 2),
        new THREE.Quaternion(),
        new THREE.Vector3(Math.max(0.3, sx), Math.max(0.3, sy), Math.max(0.3, sz))
      );
      mesh.setMatrixAt(index, matrix);
      color.setRGB(
        snapshot.colors[index * 3]!,
        snapshot.colors[index * 3 + 1]!,
        snapshot.colors[index * 3 + 2]!
      );
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();

    this.midMesh = mesh;
    this.midGroup.add(mesh);
    this.pickableObjects = [mesh];
    this.updateInteractionHighlights();
  }

  private rebuildNearGroup() {
    if (!this.snapshot) {
      return;
    }

    const snapshot = this.snapshot;
    this.nearGroup.clear();
    const focusIds = new Set<string>();
    const focusRadius = THREE.MathUtils.lerp(18, 110, this.holarchyDepth);

    snapshot.anchorIds.forEach((anchorId, index) => {
      const px = snapshot.positions[index * 3]!;
      const py = snapshot.positions[index * 3 + 1]!;
      const pz = snapshot.positions[index * 3 + 2]!;
      const distance = new THREE.Vector3(px, py, pz).distanceTo(this.camera.position);

      if (distance < focusRadius || this.selection?.id === anchorId || this.hoveredSelection?.id === anchorId) {
        focusIds.add(anchorId);
      }
    });

    if (this.selection?.kind === 'anchor') {
      focusIds.add(this.selection.id);
    }

    if (this.hoveredSelection?.kind === 'anchor') {
      focusIds.add(this.hoveredSelection.id);
    }

    if (this.selection?.kind === 'relation') {
      this.addRelationEndpointsToFocus(focusIds, this.selection.id);
    }

    if (this.hoveredSelection?.kind === 'relation') {
      this.addRelationEndpointsToFocus(focusIds, this.hoveredSelection.id);
    }

    focusIds.forEach((anchorId) => {
      const index = snapshot.anchorIds.indexOf(anchorId);

      if (index === -1) {
        return;
      }

      const position = new THREE.Vector3(
        snapshot.positions[index * 3]!,
        snapshot.positions[index * 3 + 1]!,
        snapshot.positions[index * 3 + 2]!
      );
      const size = new THREE.Vector3(
        snapshot.sizes[index * 3]!,
        snapshot.sizes[index * 3 + 1]!,
        snapshot.sizes[index * 3 + 2]!
      );
      const color = new THREE.Color(
        snapshot.colors[index * 3]!,
        snapshot.colors[index * 3 + 1]!,
        snapshot.colors[index * 3 + 2]!
      );

      const bodyObject = makeTransparentVoxelObject(size, color, { kind: 'anchor', id: anchorId });
      const body = bodyObject.mesh;
      body.frustumCulled = false;
      bodyObject.edges.frustumCulled = false;
      body.position.set(position.x, position.y, position.z + size.z / 2);
      bodyObject.edges.position.copy(body.position);
      this.nearGroup.add(body, bodyObject.edges);

      const entityType = snapshot.anchorEntityTypes[index]!;
      const isEmphasized = this.selection?.id === anchorId || this.hoveredSelection?.id === anchorId;
      const semanticDetail =
        isEmphasized || this.lastZoomMode === 'inspect'
          ? describeSemanticAnchorDetail(this.bundle, entityType, size, this.lastZoomMode === 'inspect')
          : undefined;

      if (semanticDetail?.overlay) {
        const overlayObject = makeTransparentVoxelObject(
          semanticDetail.overlay.size,
          new THREE.Color(semanticDetail.overlay.color),
          { kind: 'anchor', id: anchorId }
        );
        const overlay = overlayObject.mesh;
        overlay.frustumCulled = false;
        overlayObject.edges.frustumCulled = false;
        overlay.position.set(
          position.x + semanticDetail.overlay.offset.x,
          position.y + semanticDetail.overlay.offset.y,
          position.z + semanticDetail.overlay.offset.z
        );
        overlayObject.edges.position.copy(overlay.position);
        this.nearGroup.add(overlay, overlayObject.edges);
      }

      semanticDetail?.parts.forEach((partDescriptor) => {
        const partObject = makeTransparentVoxelObject(
          partDescriptor.size,
          new THREE.Color(partDescriptor.color),
          { kind: 'anchor', id: anchorId }
        );
        const part = partObject.mesh;
        part.frustumCulled = false;
        partObject.edges.frustumCulled = false;
        part.position.set(
          position.x + partDescriptor.offset.x,
          position.y + partDescriptor.offset.y,
          position.z + partDescriptor.offset.z
        );
        partObject.edges.position.copy(part.position);
        this.nearGroup.add(part, partObject.edges);
      });
    });

    this.pickableObjects = [
      ...(this.midMesh ? [this.midMesh] : []),
      ...this.nearGroup.children,
      ...this.relationGroup.children
    ];
    this.updateInteractionHighlights();
  }

  private buildRelations() {
    if (!this.snapshot) {
      return;
    }

    const snapshot = this.snapshot;
    this.dynamicTrails = [];
    this.relationGroup.clear();

    snapshot.relationIds.forEach((relationId, index) => {
      const start = new THREE.Vector3(
        snapshot.relationEndpoints[index * 6]!,
        snapshot.relationEndpoints[index * 6 + 1]!,
        snapshot.relationEndpoints[index * 6 + 2]!
      );
      const end = new THREE.Vector3(
        snapshot.relationEndpoints[index * 6 + 3]!,
        snapshot.relationEndpoints[index * 6 + 4]!,
        snapshot.relationEndpoints[index * 6 + 5]!
      );
      const styleId = snapshot.relationStyleIds[index]!;
      const style = relationTrailStyles[styleId];
      const curve = makeCurve(styleId, start, end);
      const sampleCount = Math.max(18, style.particleDensity * 2);
      const particleGeometry = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(sampleCount * 3);
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const baseSize = styleId === 'fire_front' ? 4.1 : 2.8;
      const points = new THREE.Points(
        particleGeometry,
        new THREE.PointsMaterial({
          color: style.color,
          size: baseSize,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          sizeAttenuation: true
        })
      );
      points.frustumCulled = false;
      points.userData.selection = { kind: 'relation', id: relationId };
      points.renderOrder = 3;
      this.relationGroup.add(points);
      this.dynamicTrails.push({
        baseColor: new THREE.Color(style.color),
        baseSize,
        curve,
        points,
        relationId,
        sampleCount,
        styleId
      });
    });

    this.updateInteractionHighlights();
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

  private addRelationToAnchor(anchorId: string, relationId: string) {
    const existing = this.relationIdsByAnchorId.get(anchorId);

    if (existing) {
      existing.add(relationId);
      return;
    }

    this.relationIdsByAnchorId.set(anchorId, new Set([relationId]));
  }

  private addRelationEndpointsToFocus(focusIds: Set<string>, relationId: string) {
    const endpoints = this.relationEndpointsById.get(relationId);

    if (!endpoints) {
      return;
    }

    focusIds.add(endpoints.source);
    focusIds.add(endpoints.target);
  }

  private resolveSelectionAt(clientX: number, clientY: number) {
    if (!this.snapshot || !this.renderer) {
      return undefined;
    }

    this.pointer.set(clientX, clientY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickableObjects, false);
    const hit = hits[0];

    if (!hit) {
      return undefined;
    }

    if (hit.object === this.midMesh && hit.instanceId !== undefined) {
      const id = this.snapshot.anchorIds[hit.instanceId];
      return id ? { kind: 'anchor' as const, id } : undefined;
    }

    return hit.object.userData.selection as { kind: 'anchor' | 'relation'; id: string } | undefined;
  }

  private setHoveredSelection(selection?: { kind: 'anchor' | 'relation'; id: string }) {
    if (
      this.hoveredSelection?.id === selection?.id &&
      this.hoveredSelection?.kind === selection?.kind
    ) {
      return;
    }

    this.hoveredSelection = selection;
    this.updateZoomMode(true);
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

    return { anchorLevels, relationLevels };
  }

  private bumpLevel(target: Map<string, number>, id: string, level: number) {
    target.set(id, Math.max(target.get(id) ?? 0, level));
  }

  private updateInteractionHighlights() {
    const state = this.buildHighlightState();
    this.updateMidInstanceHighlights(state);
    this.updateNearHighlights(state);
    this.updateRelationHighlights(state);
  }

  private updateMidInstanceHighlights(state: HighlightState) {
    if (!this.snapshot || !this.midMesh) {
      return;
    }

    const active = state.anchorLevels.size > 0 || state.relationLevels.size > 0;
    const mutedTint = new THREE.Color('#25443d');
    const relatedTint = new THREE.Color('#96ddc6');
    const hoverTint = new THREE.Color('#8de2ff');
    const selectedTint = new THREE.Color('#ffe2a9');
    const color = new THREE.Color();

    this.snapshot.anchorIds.forEach((anchorId, index) => {
      color.setRGB(
        this.snapshot?.colors[index * 3]!,
        this.snapshot?.colors[index * 3 + 1]!,
        this.snapshot?.colors[index * 3 + 2]!
      );

      const level = state.anchorLevels.get(anchorId) ?? 0;

      if (level === 3) {
        color.lerp(selectedTint, 0.72);
      } else if (level === 2) {
        color.lerp(hoverTint, 0.58);
      } else if (level === 1) {
        color.lerp(relatedTint, 0.36);
      } else if (active) {
        color.lerp(mutedTint, 0.42);
      }

      this.midMesh?.setColorAt(index, color);
    });

    if (this.midMesh.instanceColor) {
      this.midMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateNearHighlights(state: HighlightState) {
    const active = state.anchorLevels.size > 0 || state.relationLevels.size > 0;
    const relatedTint = new THREE.Color('#8fdac0');
    const hoverTint = new THREE.Color('#8de2ff');
    const selectedTint = new THREE.Color('#ffe2a9');

    this.nearGroup.children.forEach((child) => {
      const selection = child.userData.selection as { kind: 'anchor' | 'relation'; id: string } | undefined;
      const baseColor = child.userData.baseColor as THREE.Color | undefined;
      const role = child.userData.role as 'surface' | 'edges' | undefined;

      if (!selection || selection.kind !== 'anchor' || !baseColor || !role) {
        return;
      }

      const level = state.anchorLevels.get(selection.id) ?? 0;
      const tint = level === 3 ? selectedTint : level === 2 ? hoverTint : relatedTint;
      const blendAmount = level === 3 ? 0.72 : level === 2 ? 0.48 : level === 1 ? 0.24 : 0;
      const nextColor = baseColor.clone().lerp(tint, blendAmount);

      if (role === 'surface' && child instanceof THREE.Mesh) {
        const material = child.material;

        if (material instanceof THREE.MeshStandardMaterial) {
          material.color.copy(nextColor);
          material.opacity = active ? (level === 3 ? 0.28 : level === 2 ? 0.22 : level === 1 ? 0.16 : 0.07) : 0.12;
          material.emissive.copy(level > 0 ? tint.clone().multiplyScalar(level === 3 ? 0.26 : level === 2 ? 0.16 : 0.08) : new THREE.Color('#000000'));
        }
      }

      if (role === 'edges' && child instanceof THREE.LineSegments) {
        const material = child.material;

        if (material instanceof THREE.LineBasicMaterial) {
          material.color.copy(nextColor.clone().lerp(new THREE.Color('#ffffff'), level === 3 ? 0.42 : 0.2));
          material.opacity = level === 3 ? 0.92 : level === 2 ? 0.72 : level === 1 ? 0.34 : 0;
          child.visible = material.opacity > 0.02;
        }
      }
    });
  }

  private updateRelationHighlights(state: HighlightState) {
    const active = state.anchorLevels.size > 0 || state.relationLevels.size > 0;
    const relatedTint = new THREE.Color('#b1f0db');
    const hoverTint = new THREE.Color('#8de2ff');
    const selectedTint = new THREE.Color('#ffe2a9');

    this.dynamicTrails.forEach((trail) => {
      const material = trail.points.material;

      if (!(material instanceof THREE.PointsMaterial)) {
        return;
      }

      const level = state.relationLevels.get(trail.relationId) ?? 0;
      const tint = level === 3 ? selectedTint : level === 2 ? hoverTint : relatedTint;
      const blendAmount = level === 3 ? 0.62 : level === 2 ? 0.42 : level === 1 ? 0.18 : 0;

      material.color.copy(trail.baseColor.clone().lerp(tint, blendAmount));
      material.opacity = active ? (level === 3 ? 1 : level === 2 ? 0.95 : level === 1 ? 0.72 : 0.18) : 0.82;
      material.size = trail.baseSize * (level === 3 ? 1.42 : level === 2 ? 1.26 : level === 1 ? 1.12 : 1);
    });
  }

  private updateTrails(time: number) {
    this.dynamicTrails.forEach((trail) => {
      const style = relationTrailStyles[trail.styleId];
      const attribute = trail.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const data = attribute.array as Float32Array;

      for (let index = 0; index < trail.sampleCount; index += 1) {
        const offset = (index / trail.sampleCount + time * style.speed * 0.05) % 1;
        const point = trail.curve.getPointAt(offset);
        data[index * 3] = point.x;
        data[index * 3 + 1] = point.y;
        data[index * 3 + 2] = point.z;
      }

      attribute.needsUpdate = true;
    });
  }
}
