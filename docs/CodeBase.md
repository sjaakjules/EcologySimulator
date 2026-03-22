# CodeBase — Mountain Ash Holarchy / Panarchy Explorer

Version: 0.3  
Generated: 2026-03-21

## 1. Intent

This codebase implements a **local-first web app** that renders a **spatially faithful 3D ecological world** and supports:

- semantic zoom across scales,
- adaptive-voxel rendering,
- particle-trail relations,
- deterministic simulation,
- evidence-aware inspection,
- browser-based authoring,
- JSON-driven content bundles.

The app should feel poetic, but its runtime should be **data-oriented, worker-first, and performance-conscious**.

## 2. Core design choices

### 2.1 Frontend shell

Use **Next.js App Router** with React and TypeScript for the shell, routing, panels, docs, import/export flows, and authoring UI.

### 2.2 Scene engine

Use **Three.js directly**, not React components per scene entity.

Rationale:

- the scene is high-cardinality,
- entity counts vary strongly with zoom,
- simulation and rendering must stay decoupled from React reconciliation.

### 2.3 Renderer strategy

Use a **WebGPU-first** path via `WebGPURenderer`, with fallback to WebGL 2.

Use:

- `InstancedMesh` for repeated identical geometry,
- `BatchedMesh` when material is shared but geometry varies,
- `LOD` switching for distance-based representation changes,
- compute-ready GPU paths for high-volume trails and field animation where available.

### 2.4 Runtime topology

- **Main thread**: UI shell, inspector, authoring, input, accessibility
- **Render worker**: OffscreenCanvas + Three.js scene rendering
- **Simulation worker**: ECS, clocks, events, aggregation/disaggregation
- **No remote backend in MVP**

### 2.5 Persistence

Use **IndexedDB** for:

- content bundle cache,
- local drafts,
- scenario snapshots,
- undo / redo history,
- profiling traces if needed.

Manual JSON import/export is the collaboration mechanism for MVP.

## 3. Spatial representation

## 3.1 Metric world space

The canonical world uses **local metric coordinates**.

Default patch extent:

- `x: 100 m`
- `y: 100 m`
- `z: 110 m`

All fixed ecological entities have authoritative world transforms in meters.

**No force layout is allowed in the primary world.**

## 3.2 Adaptive semantic voxel field

The world is represented as a **semantic voxel field**, not a dense uniform raster.

Use a variable voxel ladder such as:

- `0.125 m`
- `0.25 m`
- `0.5 m`
- `1 m`
- `2 m`
- `4 m`
- `8 m`
- `16 m`

Interpretation:

- small voxels describe cavities, bark fissures, surface patches,
- medium voxels describe trunk sections, buttresses, logs, fern crowns,
- large voxels describe crowns, understory clumps, patch fields, and stand processes.

## 3.3 Chunking

Use a **sparse octree chunk system**.

Each chunk stores:

- occupancy,
- bounds,
- visible instance ranges,
- trail emitters,
- hit-test acceleration data,
- dirty flags for partial updates.

Recommended root volume for the default plot:

- `128 x 128 x 128 m`

## 3.4 Entity spatial contract

Every entity instance must carry:

```ts
interface SpatialAnchor {
  id: string;
  entityType: string;
  position: [number, number, number];
  rotation?: [number, number, number, number];
  boundsAabb: [number, number, number, number, number, number];
  organisationScale: OrganisationScale;
  fixedInWorld: boolean;
  occupancyVoxels: number[];
  surfaceAnchors?: SurfaceAnchor[];
}
```

`fixedInWorld` is `true` for trees, hollows, logs, terrain, ferns, patch features.

It is `false` for mobile fauna, weather particles, and transient render-only helpers.

## 4. Semantic zoom pipeline

## 4.1 Zoom model

Zoom changes both:

- representation detail,
- and the ontology exposed to the user.

At different scales the same ecological object may render as:

- far: point / splat cloud,
- mid: instanced voxel body,
- near: decomposed voxel subparts,
- inspect: semantic parts with anchor points and parameters.

## 4.2 Zoom decomposition

Example:

- `LargeOldEucalyptTree`
  - far: one large splat field
  - mid: trunk + crown + buttress voxel volumes
  - near: hollows, streamer patches, crown sectors, root disk
  - inspect: parameterized subparts and relations

## 4.3 LOD rules

Use distance + zoom-band + interaction state.

Pseudo-priority:

1. picked / selected entities
2. hero tree neighborhood
3. relation-highlight neighborhood
4. active fauna
5. visible but passive background entities

## 5. Relation trail system

## 5.1 Philosophy

Relations are rendered as **moving traces**, not static edges.

Trails must remain spatially anchored to world geometry.

## 5.2 Relation style grammar

Every relation family maps to a style preset:

- `resource_flow`
- `signal_plume`
- `occupancy_tether`
- `predation_arc`
- `mycelial_diffuse_star`
- `fire_front`

Each preset defines:

```ts
interface RelationTrailStyle {
  id: string;
  pathShape:
    | 'straight'
    | 'bezier'
    | 'spline'
    | 'advected-field'
    | 'branching-diffuse'
    | 'front';
  motionProfile:
    | 'pulse'
    | 'continuous-flow'
    | 'diffuse'
    | 'intermittent'
    | 'burst'
    | 'front-propagation';
  spawnAnchorMode:
    | 'centroid'
    | 'surface-random'
    | 'cavity-rim'
    | 'bark-fissure'
    | 'canopy-shell'
    | 'root-disk'
    | 'log-face'
    | 'ground-patch';
  targetAnchorMode: string;
  turbulence: number;
  linearity: number;
  particleDensity: number;
  speed: number;
  arrivalBehavior:
    | 'fade'
    | 'merge'
    | 'snap'
    | 'impact'
    | 'persistent-glow';
}
```

## 5.3 GPU strategy

Preferred path:

- GPU-driven trail state when WebGPU is available,
- CPU fallback with capped particle counts otherwise.

Use compute-oriented storage buffers or texture-based particle simulation for:

- relation particles,
- plume advection,
- fire-front advance,
- optional background weather motion.

## 5.4 Picking

Do **not** pick individual particles.

Instead pick:

- source entity,
- target entity,
- relation corridor / bounding volume,
- trail family overlay.

## 6. Simulation kernel

## 6.1 ECS model

Use a custom lightweight ECS with **struct-of-arrays** storage in the simulation worker.

Reason:

- better cache behavior,
- easier typed-array transfer,
- predictable performance,
- high-cardinality agent updates without object churn.

## 6.2 Core components

```ts
Position
Velocity
SpatialBounds
RenderableProxy
ScaleBinding
LifeState
DecayState
HydrationState
OccupancyState
ResourcePool
SignalEmitter
SignalReceiver
HabitatProvider
HabitatSeeker
GrowthModel
DisturbanceVulnerability
EvidenceTag
AuthoringMeta
```

## 6.3 Core systems

- sun / daylight system
- moisture / fog system
- growth and allocation system
- decay progression system
- cavity occupancy system
- understory light filtering system
- recruitment system
- fauna movement system
- disturbance system
- panarchy aggregation system
- evidence overlay system

## 6.4 Multi-rate clocks

Use separate clocks:

- `microTick`
- `dayTick`
- `seasonTick`
- `yearTick`
- `decadeTick`
- `eventTick`

Systems subscribe only to the clocks they need.

## 7. Data flow between threads

## 7.1 Main → simulation worker

- parameter edits
- play/pause/scrub commands
- scenario fork commands
- relation authoring edits

## 7.2 Simulation worker → render worker

- compact frame snapshots
- changed instance ranges
- changed trail emitter ranges
- selected entity overlays
- camera-dependent relevance hints (optional)

## 7.3 Main → render worker

- camera matrices
- viewport size
- picking requests
- debug toggles

Use transferable typed arrays wherever possible.

Use `SharedArrayBuffer` only when cross-origin isolation is confirmed and the app is configured for it.

## 8. Local-first data model

## 8.1 Bundle layers

Use three layers:

1. **schema layer** — validation and migrations
2. **content layer** — ecology bundle JSON
3. **save layer** — local edits, snapshots, overrides

## 8.2 File strategy

- source bundle remains readable JSON
- local overrides stored separately
- export merges source + overrides into a portable bundle

## 8.3 IndexedDB stores

Suggested object stores:

- `bundles`
- `bundleVersions`
- `scenarios`
- `snapshots`
- `authoringHistory`
- `profiling`

## 9. Authoring system

## 9.1 Inspector panels

- entity inspector
- relation inspector
- provenance inspector
- scale inspector
- trail style inspector

## 9.2 Editing operations

- change scalar parameter
- change enum parameter
- duplicate preset
- add relation
- remove relation
- assign evidence tier
- edit trail style
- change world generation values

## 9.3 Safety rules

- source bundle is immutable in memory
- edits are stored as patches
- every patch is undoable
- weak links remain executable even when starred

## 10. Performance plan

## 10.1 Hard rules

- never create one React component per ecological entity
- never compute scene graph diff by traversing JSON every frame
- never recompute full chunk occupancy on minor parameter edits
- never redraw all particles if only a subset of emitters changed

## 10.2 Scene batching

Use:

- `InstancedMesh` for repeated voxel bodies,
- `BatchedMesh` for mixed geometry with shared material,
- merged label atlases for annotations,
- chunk-local instance lists for fast culling.

## 10.3 Budget targets

Default tuning/hectare performance target:

- `60 fps` desktop
- `30 fps` integrated GPU minimum
- `<= 120k` visible static instances
- `<= 80k` relation particles
- `<= 256` mobile agents
- `<= 4 ms` simulation step budget for common ticks on desktop

## 10.4 Profiling hooks

Keep renderer and simulation counters visible in a debug overlay.

Track:

- draw calls
- instance count
- particle count
- worker message size
- simulation step time
- chunk rebuild time
- picked entity latency

## 11. Monorepo layout

```text
mountain-ash-holarchy/
  apps/
    web/
      app/
      components/
      features/
      lib/
      public/
      styles/
  packages/
    domain/
    schema/
    sim-core/
    scene3d/
    authoring/
    storage/
    worker-runtime/
    content/
      mountain-ash/
        large_old_eucalypt_content_layer_v4.json
  docs/
    PDR.md
    CodeBase.md
```

## 12. Suggested package boundaries

### `packages/domain`

- typed ecological concepts
- relation families
- scale definitions
- evidence tiers

### `packages/schema`

- zod or JSON-schema validation
- migrations
- test fixtures

### `packages/sim-core`

- ECS
- clocks
- systems
- aggregators
- deterministic RNG

### `packages/scene3d`

- chunk manager
- voxel renderer
- particle trail renderer
- picking
- LOD manager
- camera controller

### `packages/authoring`

- inspectors
- patch generation
- history
- diff application

### `packages/storage`

- IndexedDB adapters
- import/export
- snapshot serialization

### `packages/worker-runtime`

- simulation worker
- render worker
- thread protocol definitions

## 13. MVP implementation order

1. load bundle + validate schema  
2. render static terrain + hero tree + old-tree cohort  
3. add semantic zoom and picking  
4. add particle trails for 3–4 relation families  
5. add simulation worker and day/year ticks  
6. add authoring inspector + local persistence  
7. add disturbance events and panarchy overlays  
8. profile and stabilize framerate  

## 14. Non-MVP future directions

- optional collaborative publishing
- longer background simulations
- additional ecosystem bundles
- narrative tour authoring
- richer audio / sonification
- GPU-heavy plume and fluid field simulation

## 15. Notes for this revision

This revision explicitly commits to:

- **spatially faithful world coordinates**,
- **adaptive voxels of different sizes**,
- **particle trails with style grammar**,
- **standard one-of-each tuning scene with hectare alternate**,
- **local-first / local-only MVP**.
