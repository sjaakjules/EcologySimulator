import {
  organisationCheckpointIds,
  organisationCheckpointValues,
  relationTrailStyleIds,
  relationTrailStyles,
  type KindCatalogEntry,
  type NestedEntityLink,
  type OrganisationCheckpoint,
  type OrganisationCheckpointId,
  type OrganisationScale,
  type PatchTarget,
  type RelationTrailStyle,
  type RelationTrailStyleId
} from '@ecology/domain';
import { z } from 'zod';

const rawPrimitiveSchema = z.union([z.number(), z.string(), z.boolean(), z.null()]);

const rawValueSchema = z.union([
  rawPrimitiveSchema,
  z.array(z.unknown()),
  z.record(z.string(), z.unknown())
]);

const rawParameterSchema = z
  .object({
    default: rawPrimitiveSchema.optional(),
    max: z.number().optional(),
    min: z.number().optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
    tier: z.string().optional(),
    unit: z.string().optional()
  })
  .passthrough();

const rawOrganisationScaleSchema = z.object({
  checkpoint_id: z.string().optional(),
  position_0_1: z.number(),
  visible_plus_minus_0_1: z.number(),
  visible_range_0_1: z.tuple([z.number(), z.number()])
});

const rawEntitySchema = z
  .object({
    id: z.string(),
    label: z.string().optional(),
    display_label: z.string().optional(),
    kind: z.string(),
    scale: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.string(), rawParameterSchema).optional(),
    legacy_scale: z.string().optional(),
    organisation_scale: rawOrganisationScaleSchema.optional(),
    kind_branch: z.string().optional(),
    kind_scale_bounds_0_1: z.tuple([z.number(), z.number()]).optional(),
    contains_link_ids: z.array(z.string()).optional(),
    nested_in_link_ids: z.array(z.string()).optional(),
    allowed_nested_child_kind_ids: z.array(z.string()).optional(),
    allowed_container_kind_ids: z.array(z.string()).optional(),
    primary_nesting_link_type: z.string().optional()
  })
  .passthrough();

const rawRelationSchema = z
  .object({
    id: z.string(),
    from: z.string(),
    to: z.string(),
    type: z.string(),
    style_id: z.string().optional(),
    evidence_tier_override: z.string().optional(),
    description: z.string().optional(),
    support_sign: z.string().optional(),
    evidence: z.array(z.string()).optional(),
    parameters: z.record(z.string(), rawValueSchema).optional()
  })
  .passthrough();

const rawNestedLinkSchema = z
  .object({
    id: z.string(),
    parent: z.string(),
    child: z.string(),
    link_type: z.string().optional(),
    type: z.string().optional(),
    tier: z.string().optional(),
    description: z.string().optional(),
    source_ids: z.array(z.string()).optional()
  })
  .passthrough();

const rawKindCatalogEntrySchema = z
  .object({
    id: z.string(),
    label: z.string(),
    branch: z.string(),
    description: z.string().optional(),
    organisation_bounds_0_1: z.tuple([z.number(), z.number()]).optional(),
    default_checkpoint_id: z.string(),
    legacy_kind_aliases: z.array(z.string()).optional(),
    typical_child_kind_ids: z.array(z.string()).optional(),
    typical_parent_kind_ids: z.array(z.string()).optional(),
    primary_nesting_link_type: z.string().optional(),
    example_entity_ids: z.array(z.string()).optional(),
    source_ids: z.array(z.string()).optional(),
    current_entity_count: z.number().optional()
  })
  .passthrough();

const rawWorldPresetSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    extent_m: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number()
    }),
    terrain_defaults: z.record(z.string(), rawValueSchema),
    hero_tree: z.object({
      entity_id: z.string(),
      count: z.number(),
      position_m: z.tuple([z.number(), z.number(), z.number()]),
      instance_parameter_overrides: z.record(z.string(), rawParameterSchema).optional()
    }),
    cohort_defaults: z.array(
      z.object({
        entity_id: z.string(),
        label: z.string(),
        count_default: z.number(),
        count_min: z.number().optional(),
        count_max: z.number().optional(),
        spatial_pattern: z.string(),
        evidence_tier: z.string().optional(),
        notes: z.string().optional()
      })
    ),
    fauna_defaults: z.array(
      z.object({
        entity_id: z.string(),
        count_default: z.number(),
        count_min: z.number().optional(),
        count_max: z.number().optional(),
        evidence_tier: z.string().optional()
      })
    ),
    tunable_world_parameters: z.record(z.string(), rawValueSchema),
    spawn_notes: z.array(z.string()).optional()
  })
  .passthrough();

const rawScaleCheckpointSchema = z.object({
  id: z.string(),
  label: z.string(),
  value_0_1: z.number().optional(),
  description: z.string().optional(),
  examples: z.array(z.string()).optional(),
  source_ids: z.array(z.string()).optional(),
  zoom_band: z.array(z.number()).length(2).optional()
});

const rawScaleAxisSchema = z
  .object({
    axis_name: z.string(),
    display_domain_0_1: z.tuple([z.number(), z.number()]).optional(),
    entity_fields: z.record(z.string(), z.string()).optional(),
    checkpoints: z.array(rawScaleCheckpointSchema)
  })
  .passthrough();

const rawLegacyScaleBandSchema = z.object({
  id: z.string(),
  label: z.string(),
  zoom_band: z.array(z.number()).length(2),
  examples: z.array(z.string()).optional()
});

export const rawContentBundleSchema = z
  .object({
    schema_name: z.string(),
    schema_version: z.string(),
    generated_at_utc: z.string(),
    purpose: z.string(),
    design_notes: z.array(z.string()).default([]),
    evidence_tiers: z.record(z.string(), z.unknown()),
    scale_ladder: z.union([rawScaleAxisSchema, z.array(rawLegacyScaleBandSchema)]),
    kind_catalog: z.array(rawKindCatalogEntrySchema).optional(),
    nested_link_types: z.array(z.record(z.string(), z.unknown())).optional(),
    entity_catalog: z.array(rawEntitySchema),
    nested_entity_catalog: z.array(rawNestedLinkSchema).optional(),
    relation_catalog: z.array(rawRelationSchema),
    relation_style_library: z.array(z.record(z.string(), z.unknown())),
    world_model: z.record(z.string(), z.unknown()),
    world_presets: z.array(rawWorldPresetSchema),
    authoring_hints: z.record(z.string(), z.unknown()).optional(),
    local_first_runtime: z.record(z.string(), z.unknown()).optional(),
    visual_presets: z.array(z.record(z.string(), z.unknown())).optional(),
    temporal_profiles: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough();

export type RawContentBundle = z.infer<typeof rawContentBundleSchema>;

const normalizedParameterSchema = z
  .object({
    default: rawPrimitiveSchema.optional(),
    max: z.number().optional(),
    min: z.number().optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
    tier: z.string().optional(),
    unit: z.string().optional()
  })
  .passthrough();

const organisationScaleSchema = z.object({
  checkpointId: z.enum(organisationCheckpointIds),
  position01: z.number(),
  visiblePlusMinus01: z.number(),
  visibleRange01: z.tuple([z.number(), z.number()])
});

const organisationCheckpointSchema = z.object({
  id: z.enum(organisationCheckpointIds),
  label: z.string(),
  value01: z.number(),
  description: z.string().optional(),
  examples: z.array(z.string()),
  sourceIds: z.array(z.string())
});

const normalizedKindCatalogEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  branch: z.string(),
  description: z.string().optional(),
  organisationBounds01: z.tuple([z.number(), z.number()]).optional(),
  defaultCheckpointId: z.enum(organisationCheckpointIds),
  legacyKindAliases: z.array(z.string()),
  typicalChildKindIds: z.array(z.string()),
  typicalParentKindIds: z.array(z.string()),
  primaryNestingLinkType: z.string().optional(),
  exampleEntityIds: z.array(z.string()),
  sourceIds: z.array(z.string()),
  currentEntityCount: z.number()
});

const normalizedEntitySchema = z.object({
  id: z.string(),
  label: z.string(),
  displayLabel: z.string(),
  kind: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.string(), normalizedParameterSchema),
  starred: z.boolean(),
  organisationScale: organisationScaleSchema,
  legacyScale: z.string().optional(),
  kindBranch: z.string().optional(),
  kindScaleBounds01: z.tuple([z.number(), z.number()]).optional(),
  containsLinkIds: z.array(z.string()),
  nestedInLinkIds: z.array(z.string()),
  allowedNestedChildKindIds: z.array(z.string()),
  allowedContainerKindIds: z.array(z.string()),
  primaryNestingLinkType: z.string().optional()
});

const normalizedNestedLinkSchema = z.object({
  id: z.string(),
  parent: z.string(),
  child: z.string(),
  linkType: z.string(),
  tier: z.string().optional(),
  description: z.string().optional(),
  sourceIds: z.array(z.string())
});

const normalizedRelationSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  type: z.string(),
  styleId: z.enum(relationTrailStyleIds),
  evidenceTier: z.string().optional(),
  description: z.string().optional(),
  supportSign: z.string().optional(),
  evidence: z.array(z.string()),
  parameters: z.record(z.string(), normalizedParameterSchema),
  starred: z.boolean()
});

const normalizedWorldPresetSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  extent: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  }),
  terrainDefaults: z.record(z.string(), z.number()),
  heroTree: z.object({
    entityId: z.string(),
    count: z.number(),
    position: z.tuple([z.number(), z.number(), z.number()]),
    instanceParameterOverrides: z.record(z.string(), normalizedParameterSchema)
  }),
  cohortDefaults: z.array(
    z.object({
      entityId: z.string(),
      label: z.string(),
      countDefault: z.number(),
      spatialPattern: z.string(),
      evidenceTier: z.string().optional(),
      notes: z.string().optional()
    })
  ),
  faunaDefaults: z.array(
    z.object({
      entityId: z.string(),
      countDefault: z.number(),
      evidenceTier: z.string().optional()
    })
  ),
  tunableWorldParameters: z.record(z.string(), z.number().nullable()),
  spawnNotes: z.array(z.string())
});

export const normalizedBundleSchema = z.object({
  metadata: z.object({
    schemaName: z.string(),
    schemaVersion: z.string(),
    generatedAtUtc: z.string(),
    purpose: z.string()
  }),
  organisationAxis: z.object({
    axisName: z.string(),
    displayDomain01: z.tuple([z.number(), z.number()]),
    entityFields: z.record(z.string(), z.string())
  }),
  organisationCheckpoints: z.array(organisationCheckpointSchema),
  kindCatalog: z.array(normalizedKindCatalogEntrySchema),
  kindIndex: z.record(z.string(), normalizedKindCatalogEntrySchema),
  entities: z.array(normalizedEntitySchema),
  entityIndex: z.record(z.string(), normalizedEntitySchema),
  nestedLinks: z.array(normalizedNestedLinkSchema),
  nestedLinkIndex: z.record(z.string(), normalizedNestedLinkSchema),
  relations: z.array(normalizedRelationSchema),
  relationIndex: z.record(z.string(), normalizedRelationSchema),
  relationStyles: z.record(z.string(), z.custom<RelationTrailStyle>()),
  worldModel: z.object({
    plotExtentM: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number()
    }),
    voxelSizeLadderM: z.array(z.number())
  }),
  worldPresets: z.array(normalizedWorldPresetSchema),
  defaultWorldPresetId: z.string(),
  patchTargets: z.array(
    z.object({
      path: z.array(z.union([z.string(), z.number()])),
      label: z.string(),
      kind: z.enum(['number', 'string', 'enum']),
      source: z.enum(['entity', 'relation', 'world']),
      options: z.array(z.string()).optional()
    })
  )
});

export type NormalizedBundle = z.infer<typeof normalizedBundleSchema>;
export type NormalizedEntity = z.infer<typeof normalizedEntitySchema>;
export type NormalizedRelation = z.infer<typeof normalizedRelationSchema>;
export type NormalizedNestedLink = z.infer<typeof normalizedNestedLinkSchema>;

const relationTypeToStyleId: Record<string, RelationTrailStyleId> = {
  abiotic_driver: 'signal_plume',
  abiotic_subsidy: 'resource_flow',
  access_filter: 'occupancy_tether',
  carbon_and_structure_contribution: 'resource_flow',
  continuity_loss: 'fire_front',
  cross_scale_disturbance_coupling: 'fire_front',
  density_boost: 'signal_plume',
  facilitation: 'signal_plume',
  feature_formation: 'mycelial_diffuse_star',
  flammability_link: 'fire_front',
  food_provision: 'resource_flow',
  habitat_provision: 'occupancy_tether',
  host_substrate: 'occupancy_tether',
  legacy_and_refugia_modulation: 'occupancy_tether',
  memory_source: 'fire_front',
  microclimate_feedback: 'signal_plume',
  microclimate_modulation: 'signal_plume',
  microhabitat_support: 'occupancy_tether',
  moisture_substrate_support: 'signal_plume',
  mortality_driver: 'predation_arc',
  nurse_substrate: 'occupancy_tether',
  occupancy_state_shift: 'occupancy_tether',
  panarchy_binding: 'fire_front',
  panarchy_remember: 'fire_front',
  part_formation: 'mycelial_diffuse_star',
  population_reduction: 'predation_arc',
  propagule_flow: 'resource_flow',
  refugia_provision: 'occupancy_tether',
  resource_modulation: 'resource_flow',
  resource_partitioning: 'resource_flow',
  state_transition: 'mycelial_diffuse_star',
  stress_buffer: 'signal_plume',
  structural_enrichment: 'mycelial_diffuse_star',
  structure_concentration: 'mycelial_diffuse_star',
  substrate_provision: 'resource_flow',
  substrate_removal: 'mycelial_diffuse_star',
  symbiotic_coupling: 'signal_plume',
  transformation: 'mycelial_diffuse_star',
  water_feedback: 'resource_flow'
};

const legacyScaleToCheckpoint: Record<string, OrganisationCheckpointId> = {
  disturbance_regime: 'landscape',
  guild: 'colony',
  household_colony: 'colony',
  landscape: 'landscape',
  microhabitat: 'part',
  molecular_signal: 'micro',
  organ: 'part',
  organism: 'organism',
  panarchy: 'systemic',
  part: 'part',
  population: 'colony',
  stand: 'community',
  systemic: 'systemic',
  tissue_surface: 'micro'
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizePathShape(value: unknown): RelationTrailStyle['pathShape'] {
  switch (value) {
    case 'curved_bezier':
      return 'bezier';
    case 'advected_field_curve':
      return 'advected-field';
    case 'short_arc_or_elastic_tether':
    case 'ballistic_or_spline_arc':
      return 'spline';
    case 'branching_diffuse_network':
      return 'branching-diffuse';
    case 'advancing_sheet_or_front':
      return 'front';
    default:
      return 'straight';
  }
}

function normalizeMotionProfile(value: unknown): RelationTrailStyle['motionProfile'] {
  switch (value) {
    case 'directed_pulse_train':
      return 'continuous-flow';
    case 'wiggle_diffuse_then_bias':
      return 'diffuse';
    case 'intermittent_commute':
      return 'intermittent';
    case 'burst_then_capture':
      return 'burst';
    case 'slow_creep_and_pulse':
      return 'pulse';
    case 'front_propagation':
      return 'front-propagation';
    default:
      return 'pulse';
  }
}

function normalizeAnchorMode(value: unknown): RelationTrailStyle['spawnAnchorMode'] {
  switch (value) {
    case 'cavity_rim':
      return 'cavity-rim';
    case 'bark_fissure':
      return 'bark-fissure';
    case 'canopy_shell':
      return 'canopy-shell';
    case 'root_disk':
      return 'root-disk';
    case 'log_face':
      return 'log-face';
    case 'ground_patch':
      return 'ground-patch';
    case 'surface_random':
      return 'surface-random';
    default:
      return 'centroid';
  }
}

function normalizeParameterValue(value: unknown): z.infer<typeof normalizedParameterSchema> {
  if (isRecord(value)) {
    return rawParameterSchema.parse(value);
  }

  if (Array.isArray(value)) {
    return { default: JSON.stringify(value) };
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return { default: value };
  }

  return {};
}

function normalizeParameterRecord(record?: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record ?? {}).map(([key, value]) => [key, normalizeParameterValue(value)])
  );
}

function coerceNumericValue(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (isRecord(value) && typeof value.default === 'number') {
    return value.default;
  }

  return 0;
}

function coerceNullableNumericValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (isRecord(value)) {
    if (typeof value.default === 'number') {
      return value.default;
    }

    if (value.default === null) {
      return null;
    }
  }

  return value === null ? null : 0;
}

function coerceNumericRecord(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, coerceNumericValue(value)]));
}

function coerceNullableNumericRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, coerceNullableNumericValue(value)])
  );
}

function normalizeRelationStyles(rawBundle: RawContentBundle): Record<RelationTrailStyleId, RelationTrailStyle> {
  const overrides = Object.fromEntries(
    rawBundle.relation_style_library
      .map((style) => {
        const styleId = style.id;

        if (typeof styleId !== 'string' || !(styleId in relationTrailStyles)) {
          return undefined;
        }

        const base = relationTrailStyles[styleId as RelationTrailStyleId];

        return [
          styleId,
          {
            ...base,
            pathShape: normalizePathShape(style.path_shape),
            motionProfile: normalizeMotionProfile(style.motion_profile),
            spawnAnchorMode: normalizeAnchorMode(style.spawn_anchor_mode),
            targetAnchorMode: normalizeAnchorMode(style.target_anchor_mode),
            turbulence:
              typeof style.turbulence_0_1 === 'number' ? style.turbulence_0_1 : base.turbulence,
            linearity:
              typeof style.linearity_0_1 === 'number' ? style.linearity_0_1 : base.linearity
          } satisfies RelationTrailStyle
        ] as const;
      })
      .filter((entry): entry is readonly [RelationTrailStyleId, RelationTrailStyle] => Boolean(entry))
  );

  return {
    ...relationTrailStyles,
    ...overrides
  };
}

function isStarredLabel(label?: string): boolean {
  return Boolean(label?.includes('*'));
}

function isStarredParameterRecord(record?: Record<string, unknown>): boolean {
  return Object.values(record ?? {}).some(
    (parameter) =>
      isRecord(parameter) &&
      'tier' in parameter &&
      (parameter as { tier?: unknown }).tier === 'weak_active_starred'
  );
}

function resolveOrganisationCheckpointId(value: string | undefined): OrganisationCheckpointId {
  if (value && (organisationCheckpointIds as readonly string[]).includes(value)) {
    return value as OrganisationCheckpointId;
  }

  if (value) {
    const mapped = legacyScaleToCheckpoint[value];
    if (mapped) {
      return mapped;
    }
  }

  return 'community';
}

function normalizeOrganisationAxis(
  rawScaleLadder: RawContentBundle['scale_ladder']
): {
  organisationAxis: NormalizedBundle['organisationAxis'];
  organisationCheckpoints: OrganisationCheckpoint[];
} {
  if (Array.isArray(rawScaleLadder)) {
    const checkpointsById = new Map<OrganisationCheckpointId, OrganisationCheckpoint>();

    rawScaleLadder.forEach((scale) => {
      const checkpointId = resolveOrganisationCheckpointId(scale.id);
      if (checkpointsById.has(checkpointId)) {
        return;
      }

      checkpointsById.set(checkpointId, {
        id: checkpointId,
        label: scale.label,
        value01: organisationCheckpointValues[checkpointId],
        description: undefined,
        examples: scale.examples ?? [],
        sourceIds: []
      });
    });

    const organisationCheckpoints = organisationCheckpointIds.map(
      (checkpointId) =>
        checkpointsById.get(checkpointId) ?? {
          id: checkpointId,
          label: checkpointId,
          value01: organisationCheckpointValues[checkpointId],
          description: undefined,
          examples: [],
          sourceIds: []
        }
    );

    return {
      organisationAxis: {
        axisName: 'organisation_scale_0_1',
        displayDomain01: [0.02, 0.98],
        entityFields: {
          nearest_checkpoint_field: 'scale',
          legacy_checkpoint_field: 'legacy_scale',
          position_field: 'organisation_scale.position_0_1',
          visible_plus_minus_field: 'organisation_scale.visible_plus_minus_0_1',
          visible_range_field: 'organisation_scale.visible_range_0_1'
        }
      },
      organisationCheckpoints
    };
  }

  return {
    organisationAxis: {
      axisName: rawScaleLadder.axis_name,
      displayDomain01: rawScaleLadder.display_domain_0_1 ?? [0.02, 0.98],
      entityFields: rawScaleLadder.entity_fields ?? {
        nearest_checkpoint_field: 'scale',
        legacy_checkpoint_field: 'legacy_scale',
        position_field: 'organisation_scale.position_0_1',
        visible_plus_minus_field: 'organisation_scale.visible_plus_minus_0_1',
        visible_range_field: 'organisation_scale.visible_range_0_1'
      }
    },
    organisationCheckpoints: rawScaleLadder.checkpoints.map((checkpoint) => ({
      id: resolveOrganisationCheckpointId(checkpoint.id),
      label: checkpoint.label,
      value01:
        typeof checkpoint.value_0_1 === 'number'
          ? checkpoint.value_0_1
          : organisationCheckpointValues[resolveOrganisationCheckpointId(checkpoint.id)],
      description: checkpoint.description,
      examples: checkpoint.examples ?? [],
      sourceIds: checkpoint.source_ids ?? []
    }))
  };
}

function normalizeOrganisationScale(
  entity: RawContentBundle['entity_catalog'][number],
  axisDisplayDomain: [number, number]
): OrganisationScale {
  const checkpointId = resolveOrganisationCheckpointId(entity.organisation_scale?.checkpoint_id ?? entity.scale);

  if (entity.organisation_scale) {
    return {
      checkpointId,
      position01: entity.organisation_scale.position_0_1,
      visiblePlusMinus01: entity.organisation_scale.visible_plus_minus_0_1,
      visibleRange01: entity.organisation_scale.visible_range_0_1
    };
  }

  const position01 = organisationCheckpointValues[checkpointId];
  const visiblePlusMinus01 = checkpointId === 'part' || checkpointId === 'organism' ? 0.12 : 0.14;

  return {
    checkpointId,
    position01,
    visiblePlusMinus01,
    visibleRange01: [
      clamp(position01 - visiblePlusMinus01, axisDisplayDomain[0], axisDisplayDomain[1]),
      clamp(position01 + visiblePlusMinus01, axisDisplayDomain[0], axisDisplayDomain[1])
    ]
  };
}

function normalizeKindCatalog(
  rawBundle: RawContentBundle
): {
  kindCatalog: KindCatalogEntry[];
  kindIndex: Record<string, KindCatalogEntry>;
} {
  const kindCatalog = (rawBundle.kind_catalog ?? []).map((kind) => ({
    id: kind.id,
    label: kind.label,
    branch: kind.branch,
    description: kind.description,
    organisationBounds01: kind.organisation_bounds_0_1,
    defaultCheckpointId: resolveOrganisationCheckpointId(kind.default_checkpoint_id),
    legacyKindAliases: kind.legacy_kind_aliases ?? [],
    typicalChildKindIds: kind.typical_child_kind_ids ?? [],
    typicalParentKindIds: kind.typical_parent_kind_ids ?? [],
    primaryNestingLinkType: kind.primary_nesting_link_type,
    exampleEntityIds: kind.example_entity_ids ?? [],
    sourceIds: kind.source_ids ?? [],
    currentEntityCount: kind.current_entity_count ?? 0
  }));

  return {
    kindCatalog,
    kindIndex: Object.fromEntries(kindCatalog.map((kind) => [kind.id, kind]))
  };
}

function normalizeNestedLinks(rawBundle: RawContentBundle): {
  nestedLinks: NestedEntityLink[];
  nestedLinkIndex: Record<string, NestedEntityLink>;
} {
  const nestedLinks = (rawBundle.nested_entity_catalog ?? []).map((link) => ({
    id: link.id,
    parent: link.parent,
    child: link.child,
    linkType: link.link_type ?? link.type ?? 'member',
    tier: link.tier,
    description: link.description,
    sourceIds: link.source_ids ?? []
  }));

  return {
    nestedLinks,
    nestedLinkIndex: Object.fromEntries(nestedLinks.map((link) => [link.id, link]))
  };
}

function extractPatchTargets(rawBundle: RawContentBundle): PatchTarget[] {
  const targets: PatchTarget[] = [];

  rawBundle.world_presets.forEach((preset, presetIndex) => {
    Object.keys(preset.tunable_world_parameters).forEach((key) => {
      targets.push({
        path: ['world_presets', presetIndex, 'tunable_world_parameters', key, 'default'],
        label: `${preset.label}: ${key}`,
        kind: 'number',
        source: 'world'
      });
    });
  });

  rawBundle.entity_catalog.forEach((entity, entityIndex) => {
    Object.entries(entity.parameters ?? {}).forEach(([parameterKey, parameterValue]) => {
      const defaultValue = parameterValue.default;
      targets.push({
        path: ['entity_catalog', entityIndex, 'parameters', parameterKey, 'default'],
        label: `${entity.display_label ?? entity.label ?? entity.id}: ${parameterKey}`,
        kind: typeof defaultValue === 'number' ? 'number' : 'string',
        source: 'entity'
      });
    });
  });

  rawBundle.relation_catalog.forEach((relation, relationIndex) => {
    targets.push({
      path: ['relation_catalog', relationIndex, 'style_id'],
      label: `${relation.id}: relation style override`,
      kind: 'enum',
      source: 'relation',
      options: Object.keys(relationTrailStyles)
    });
    targets.push({
      path: ['relation_catalog', relationIndex, 'evidence_tier_override'],
      label: `${relation.id}: evidence tier override`,
      kind: 'enum',
      source: 'relation',
      options: Object.keys(rawBundle.evidence_tiers)
    });
  });

  return targets;
}

export function resolveRelationStyleId(type: string): RelationTrailStyleId {
  const resolved = relationTypeToStyleId[type];

  if (!resolved) {
    throw new Error(`No relation style mapping for relation type "${type}"`);
  }

  return resolved;
}

export function normalizeBundle(rawInput: unknown): NormalizedBundle {
  const rawBundle = rawContentBundleSchema.parse(rawInput);
  const relationStyles = normalizeRelationStyles(rawBundle);
  const { organisationAxis, organisationCheckpoints } = normalizeOrganisationAxis(rawBundle.scale_ladder);
  const { kindCatalog, kindIndex } = normalizeKindCatalog(rawBundle);
  const { nestedLinks, nestedLinkIndex } = normalizeNestedLinks(rawBundle);

  const entities = rawBundle.entity_catalog.map((entity) => {
    const kind = kindIndex[entity.kind];
    return {
      id: entity.id,
      label: entity.label ?? entity.id,
      displayLabel: entity.display_label ?? entity.label ?? entity.id,
      kind: entity.kind,
      description: entity.description,
      parameters: normalizeParameterRecord(entity.parameters),
      starred: isStarredLabel(entity.display_label) || isStarredParameterRecord(entity.parameters),
      organisationScale: normalizeOrganisationScale(entity, organisationAxis.displayDomain01),
      legacyScale: entity.legacy_scale,
      kindBranch: entity.kind_branch ?? kind?.branch,
      kindScaleBounds01: entity.kind_scale_bounds_0_1 ?? kind?.organisationBounds01,
      containsLinkIds: entity.contains_link_ids ?? [],
      nestedInLinkIds: entity.nested_in_link_ids ?? [],
      allowedNestedChildKindIds: entity.allowed_nested_child_kind_ids ?? kind?.typicalChildKindIds ?? [],
      allowedContainerKindIds: entity.allowed_container_kind_ids ?? kind?.typicalParentKindIds ?? [],
      primaryNestingLinkType: entity.primary_nesting_link_type ?? kind?.primaryNestingLinkType
    };
  });

  const entityIndex = Object.fromEntries(entities.map((entity) => [entity.id, entity]));

  const relations = rawBundle.relation_catalog.map((relation) => {
    const styleId =
      relation.style_id && relation.style_id in relationStyles
        ? (relation.style_id as RelationTrailStyleId)
        : resolveRelationStyleId(relation.type);
    const sourceEntity = entityIndex[relation.from];
    const targetEntity = entityIndex[relation.to];

    return {
      id: relation.id,
      from: relation.from,
      to: relation.to,
      type: relation.type,
      styleId,
      evidenceTier: relation.evidence_tier_override,
      description: relation.description,
      supportSign: relation.support_sign,
      evidence: relation.evidence ?? [],
      parameters: normalizeParameterRecord(relation.parameters),
      starred:
        isStarredParameterRecord(relation.parameters) ||
        Boolean(sourceEntity?.starred) ||
        Boolean(targetEntity?.starred)
    };
  });

  const relationIndex = Object.fromEntries(relations.map((relation) => [relation.id, relation]));

  const worldModel = {
    plotExtentM: {
      x: Number((rawBundle.world_model.plot_extent_m as { x?: number })?.x ?? 100),
      y: Number((rawBundle.world_model.plot_extent_m as { y?: number })?.y ?? 100),
      z: Number((rawBundle.world_model.plot_extent_m as { z?: number })?.z ?? 100)
    },
    voxelSizeLadderM: Array.isArray(rawBundle.world_model.voxel_size_ladder_m)
      ? rawBundle.world_model.voxel_size_ladder_m.map((value) => Number(value))
      : [0.125, 0.25, 0.5, 1, 2, 4, 8, 16]
  };

  const worldPresets = rawBundle.world_presets.map((preset) => ({
    id: preset.id,
    label: preset.label,
    description: preset.description,
    extent: preset.extent_m,
    terrainDefaults: coerceNumericRecord(preset.terrain_defaults),
    heroTree: {
      entityId: preset.hero_tree.entity_id,
      count: preset.hero_tree.count,
      position: preset.hero_tree.position_m,
      instanceParameterOverrides: normalizeParameterRecord(preset.hero_tree.instance_parameter_overrides)
    },
    cohortDefaults: preset.cohort_defaults.map((item) => ({
      entityId: item.entity_id,
      label: item.label,
      countDefault: item.count_default,
      spatialPattern: item.spatial_pattern,
      evidenceTier: item.evidence_tier,
      notes: item.notes
    })),
    faunaDefaults: preset.fauna_defaults.map((item) => ({
      entityId: item.entity_id,
      countDefault: item.count_default,
      evidenceTier: item.evidence_tier
    })),
    tunableWorldParameters: coerceNullableNumericRecord(preset.tunable_world_parameters),
    spawnNotes: preset.spawn_notes ?? []
  }));

  return normalizedBundleSchema.parse({
    metadata: {
      schemaName: rawBundle.schema_name,
      schemaVersion: rawBundle.schema_version,
      generatedAtUtc: rawBundle.generated_at_utc,
      purpose: rawBundle.purpose
    },
    organisationAxis,
    organisationCheckpoints,
    kindCatalog,
    kindIndex,
    entities,
    entityIndex,
    nestedLinks,
    nestedLinkIndex,
    relations,
    relationIndex,
    relationStyles,
    worldModel,
    worldPresets,
    defaultWorldPresetId: worldPresets[0]?.id,
    patchTargets: extractPatchTargets(rawBundle)
  });
}
