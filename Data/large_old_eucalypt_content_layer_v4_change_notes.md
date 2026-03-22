# Large old eucalypt content layer v4

## What changed

This revision does four main things:

1. Replaces the old discrete `scale_ladder` bands with a continuous `organisation_scale_0_1` axis.
2. Merges the former **part** and **microhabitat** strata into a single kind: **structural_locale**.
3. Adds a structured `kind_catalog` with scale bounds, nesting defaults and allowed parent/child kinds.
4. Adds a separate `nested_entity_catalog` so composition, membership, subsets and hosted associations are explicit rather than mixed into the ecological influence graph.

## New organisation checkpoints

- `micro` = 0.06
- `macro` = 0.16
- `part` = 0.29
- `organism` = 0.44
- `colony` = 0.57
- `community` = 0.70
- `landscape` = 0.84
- `systemic` = 0.95

Each entity now has:

- `scale` → nearest checkpoint id
- `legacy_scale` → original discrete label
- `organisation_scale.position_0_1`
- `organisation_scale.visible_plus_minus_0_1`
- `organisation_scale.visible_range_0_1`

## New compositional structure

- `relation_catalog` is still the causal / ecological influence graph.
- `nested_entity_catalog` is now the compositional / membership / subset graph.
- `nested_link_types` distinguishes:
  - `material_part`
  - `hosted_associate`
  - `member`
  - `subset`
  - `field_contains`
  - `memory_contains`
  - `state_successor`

## Key ontology decisions

- Hollows, buttresses, bark streamers, fire scars, crown modules and root mats are treated as **structural locales** because they are both **parts** of larger bodies and **habitat-providing small natural features**.
- `StandStructuralComplexityField` is regularized as a `structural_field`.
- `LandscapeMemoryField` remains distinct as a `memory_field`.
- `LeadbeatersPossumColony` is regularized as a `colony`.
- `RainforestUnderstoryGuild` and `BryophyteLichenGuild` are regularized as `community`-type assemblages.
- `TreeFernGuild` is regularized as a `guild`, not a single organism.

## Practical editing consequence

When adding a new nesting relation:

1. Check the parent and child kinds in `kind_catalog`.
2. Use the allowed parent/child bounds and default link type there.
3. Add the explicit link to `nested_entity_catalog`.
4. Only add a corresponding entry to `relation_catalog` if there is an ecological influence, transformation or disturbance effect beyond composition itself.
