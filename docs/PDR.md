# PDR — Mountain Ash Holarchy / Panarchy Explorer

Version: 0.3  
Generated: 2026-03-21

## 1. Product summary

Build a **local-first web application** for exploring and simulating a **relational, multi-scale ecological world** centered on a **large old Mountain Ash tree** (*Eucalyptus regnans*) in **wet sclerophyll forest** of the Central Highlands of Victoria.

The interface should feel **poetic, exploratory, atmospheric, and spatially truthful**: somewhere between a **3D LiDAR point cloud**, a **living voxel field**, and a **network diagram made of particles and traces**.

The app must let a user:

- move through a 3D forest world,
- zoom between scales of organization,
- watch beings decompose into parts or collate into larger wholes,
- inspect parameters and provenance,
- run daily / seasonal / annual / disturbance cycles,
- edit parameters and relations in the browser,
- keep weak mechanisms active, visibly marked with `*`,
- stay fully usable when run locally on one machine with no remote backend.

## 2. Canonical ecological anchor

The first canonical world is:

**1 hectare of old-growth Mountain Ash wet sclerophyll forest, Styx Valley Tasmania, with one hero large old tree and its surrounding relational field.**

This anchor is selected because the attached literature is unusually strong on:

- old-growth Mountain Ash structure,
- large old hollow-bearing trees,
- tree decay trajectories,
- cavity-user differentiation,
- bark streamers and buttresses,
- tree ferns,
- bryophytes and lichens,
- fallen timber as a wet nurse substrate,
- stand structural complexity,
- panarchy-relevant disturbance and reorganization.

### 2.1 Ecological grounding for the canonical patch

The canonical patch should be able to express the following attached findings:

- old-growth Mountain Ash stands are mainly overstorey trees older than 180 years, typically larger than 2 m DBH with one large internal basal hollow;
- old-growth structure includes large diameter living trees, multiple age cohorts, numerous living and dead cavity trees, bark streamers, mistletoe, tree ferns, rainforest understorey, and large fallen trees;
- a hollow-bearing tree is operationally defined in the Mountain Ash monitoring work as a tree greater than 80 cm DBH with an obvious hollow;
- old-growth stands can support more than 30 hollow-bearing trees per hectare;
- different cavity-using animals partition tree states, heights, and decay forms;
- tree ferns can persist for centuries, survive fire, host epiphytes, and provide germination sites;
- fallen timber supports bryophytes, ferns, rainforest germination, moisture retention, fungi, and later fauna use;
- stand structural complexity should not be flattened into one primitive number, but remain multi-axis.

## 3. Experience principles

### 3.1 Spatial truth first

The primary world view must be **fully spatially faithful**.

That means:

- trees, hollows, logs, ferns, understorey clumps, and terrain have stable positions in metric world coordinates;
- the main view is **not** force-directed;
- relations may arc, pulse, wiggle, diffuse, or stream through space, while the ecological structures move depending on their motion (branches, leaves sway, animals climb, birds fly, fungi plants grow and bloom / fruit.

A relation-focus mode may temporarily offset **labels, annotations, or non-authoritative visual helpers**, but never the underlying ecological anchors.

### 3.2 Poetic, not merely diagrammatic

The scene should feel like entering a living field of relations rather than opening a dashboard.

### 3.3 Scientific, not overly literal

The world can be partly abstracted, but it should remain grounded in real ecological structure and real spatial organization.

### 3.4 Weak links stay active

Weakly evidenced mechanisms remain active by default, but are marked with `*` in labels and provenance panels.

## 4. Primary interface vision

The primary interface is a **3D adaptive semantic voxel world**.

This is **not** a dense Minecraft-like cube field. Instead it is a variable-resolution ecological representation where:

- a hollow may be represented by a tight cluster of small voxels,
- a trunk by larger stacked voxels,
- a tree crown by diffuse shell voxels or splats,
- a stand by broad, semi-transparent volumetric fields,
- and a landscape process by large-scale overlays or moving fronts.

## 5. Spatial world model

### 5.1 Patch extent

Default MVP world:

- **100 m x 100 m x 100 m** plot volume,
- one main hero tree near the center,
- surrounding old trees and decayed trees,
- large fallen logs,
- tree fern-rich gully sectors,
- rainforest understory clumps,
- bryophyte/lichen-rich substrate patches,
- a small dependent fauna set,
- sun and environment.

### 5.2 Plot composition defaults

These are **default generation settings**, not final scientific truth. They should be editable in the browser.

- hero large old tree: `1`
- supporting living old trees: default `9`
- standing dead hollow trees: default `16`
- large fallen logs: default `22`
- tree ferns: default `95`
- rainforest understory clumps: default `28`
- wattle patches: default `7`
- bryophyte / lichen patches: default `180`
- recruitment / offspring field: default `1` patch
- hollow-bearing trees per hectare baseline: default `32`

### 5.3 Hero tree defaults

Default hero tree parameters:

- approximate DBH: `2.8 m`
- approximate height: `68 m`
- approximate age: `320 years`
- visible hollows: `6`
- buttress radius: `4.2 m`
- bark streamer abundance: `0.82`
- mistletoe clumps: `3`

These values are deliberately split between:

- literature-grounded ranges,
- attached-synthesis defaults,
- and designer placeholders that will be tuned later.

## 6. Semantic zoom and holarchy

Zoom is not only camera distance. It changes the actionable ontology, the holarchy that are in focus.

### 6.1 Scale bands

1. **Signal / tissue** — exudates, scars, bark fissures, moisture films  
2. **Microhabitat** — hollows, bark streamer patches, buttress pockets, nurse-log faces  
3. **Part / organ** — crown sectors, roots, trunk, buttresses, lateral branches  
4. **Organism** — tree, fern, glider, possum, owl, fungus  
5. **Guild / colony** — bryophyte patch, possum colony, saproxylic guild  
6. **Stand** — old-growth patch, structural complexity field, deadwood mosaic  
7. **Landscape / panarchy** — refugia, fire mosaic, logging matrix, memory / revolt links

### 6.2 Zoom behavior

- each entity has a home scale;
- entities are most opaque and most editable at home scale;
- outside home scale they fade, but remain spatially present;
- crossing a scale threshold triggers decomposition or aggregation animation;
- aggregation must preserve measurable meaning, not just visual convenience.

## 7. Relation rendering grammar

Relations are rendered as **particle trails or moving fields**, not hard lines.

Each relation family has its own visual grammar.

### 7.1 Core relation families

- **resource flow** — curving, directed pulses between source and sink
- **signal plume** — diffusing, wiggling, atmosphere-like motion
- **occupancy / denning** — short elastic tethers between organism and cavity / structure
- **predation / pursuit** — ballistic arcs or biased splines toward moving targets
- **mycelial / decay spread** — branching diffuse creep through substrate
- **fire / disturbance** — advancing fronts or sweeping sheets

### 7.2 Trail parameters

Every relation style can vary by:

- curvature,
- turbulence / wiggle,
- linearity,
- particle density,
- pulse interval,
- speed,
- thickness,
- fade profile,
- source anchor mode,
- target anchor mode,
- source emission pattern,
- target capture pattern,
- arrival behavior.

### 7.3 Anchor modes

Trails should be able to originate or terminate at:

- entity centroids,
- random points on a surface,
- cavity rims,
- bark fissures,
- canopy shells,
- root disks,
- log faces,
- ground patches.

## 8. Simulation model

### 8.1 Multi-rate time

The simulation should support multiple clocks:

- sub-hourly signal / microclimate ticks,
- daily sun / moisture / movement,
- seasonal phenology,
- annual growth and mortality,
- decadal decay and structural transition,
- episodic events such as drought, wildfire, or logging.

### 8.2 Core cyclical systems

- sunlight angle and daylight length,
- moisture and fog presence,
- understory light windows,
- animal movement / occupancy switching,
- flowering / seed / bloom pulses,
- decay class progression,
- stand adaptive-cycle shifts.

### 8.3 Disturbance systems

The MVP should support:

- wildfire,
- drought,
- selective parameter shocks,
- optional logging / salvage logging overlays,
- recovery and reorganization afterwards.

## 9. Panarchy behavior

Panarchy is represented as nested adaptive cycles and cross-scale links:

- **growth**,
- **conservation**,
- **release**,
- **reorganization**.

The scene must show:

- memory sources,
- revolt links,
- cross-scale buffering,
- cross-scale amplification,
- and post-disturbance reorganization.

Large old trees, hollows, logs, tree ferns, and remnant old-growth patches are treated as **memory-bearing structures**.

## 10. Authoring

Browser-based authoring is in scope for MVP.

Users should be able to:

- edit parameter values,
- duplicate and tune presets,
- add new relations,
- change evidence tiers,
- edit relation visual styles,
- export the edited bundle to JSON,
- reload the world from the edited bundle.

### 10.1 Authoring priority

Primary emphasis is on **editing existing parameters**, not inventing a huge number of new relation types.

## 11. Local-first requirement

MVP is **local-first and local-only**.

That means:

- no remote backend is required,
- no sign-in is required,
- all content and edits persist locally,
- all scenarios are saved locally,
- all sharing is manual export/import in MVP.

## 12. Performance targets

For the default 1 ha patch:

- desktop target: `60 fps`
- integrated GPU minimum: `30 fps`
- static visible instances budget: `120,000`
- visible relation particle budget: `80,000`
- concurrent mobile agent budget: `256`

These are design targets and can be revised after profiling.

## 13. MVP acceptance criteria

The MVP is successful when:

1. the user can fly or walk through a spatially faithful 1 ha Mountain Ash patch;
2. the hero tree, hollows, logs, tree ferns, and understory are all inspectable;
3. zooming in and out changes what entities are available and how they decompose;
4. trails visibly differ by relation family;
5. fixed ecological structures do not drift from their metric positions;
6. browser-based parameter editing changes world state and visuals;
7. weak links are active and visibly starred in text when selected, indistinguishable otherwise;
8. the entire app runs locally without a remote service.

## 14. Risks and unresolved design tensions

- how voxel-like close-range surfaces should remain before they become too chunky;
- how much visual abstraction is tolerable before ecological meaning is lost;
- when to show true volume versus splat-like impressions;
- how to keep the world beautiful without hiding uncertainty;
- how much simulation should be real-time versus event-stepped.

## 15. Deliverables in this revision

This revision should produce:

- updated `PDR.md`
- updated `CodeBase.md`
- updated `large_old_eucalypt_content_layer_v3.json`

## 16. Grounding sources

Primary ecological grounding:

- Lindenmayer et al. — *Mountain Ash: Fire, Logging and the Future of Victoria’s Giant Forests*
- Lindenmayer & Laurance — *The ecology, distribution, conservation and management of large old trees*
- Lindenmayer — *Conserving large old trees as small natural features*
- McElhinny et al. — *Forest and Woodland Stand Structural Complexity*
- Deng et al. — *Forest understory vegetation study: current status and future trends*
- Sundstrom et al. — *Panarchy theory for convergence*
