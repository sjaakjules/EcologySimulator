'use client';

import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

import { relationTrailStyleIds, type FrameSnapshot, type SelectionOverlay, type WorldViewMode } from '@ecology/domain';
import type { NormalizedBundle, RawContentBundle } from '@ecology/schema';
import { renderPointBudgetPresets, type RenderVisualSettings } from '@ecology/worker-runtime';

export type PanelId = 'simulation' | 'world' | 'inspector' | 'ecology' | 'visuals';
export interface PanelState {
  open: boolean;
  pinned: boolean;
}

export interface VisualControlState {
  cameraZoom: number;
  holarchyDepth: number;
  lockCameraZoom: boolean;
  lockHolarchyDepth: boolean;
  pointBudgetPreset: RenderVisualSettings['pointBudgetPreset'];
  maxPoints: number;
  dofMode: RenderVisualSettings['dofMode'];
  focusDistance: number;
  focusLock: RenderVisualSettings['focusLock'];
  glowMode: RenderVisualSettings['glowMode'];
  transparencyMode: RenderVisualSettings['transparencyMode'];
}

interface NumberFieldProps {
  label: string;
  onCommit(value: number): void;
  value: number;
}

interface PanelDrawerProps {
  children: ReactNode;
  copy: string;
  eyebrow: string;
  isPinned: boolean;
  isOpen: boolean;
  panelId: PanelId;
  side: 'left' | 'right' | 'bottom';
  slot: 'upper' | 'lower' | 'center';
  tabLabel?: string;
  title: string;
  onTogglePin(panelId: PanelId): void;
  onToggle(panelId: PanelId): void;
}

interface SliderFieldProps {
  label: string;
  locked: boolean;
  max?: number;
  min?: number;
  onChange(value: number): void;
  onToggleLock(): void;
  step?: number;
  value: number;
}

interface ControlPanelProps {
  backendLabel: string;
  bundle: NormalizedBundle;
  panelStates: Record<PanelId, PanelState>;
  playing: boolean;
  rawBundle: RawContentBundle;
  selection?: SelectionOverlay;
  snapshot?: FrameSnapshot;
  status: string;
  visuals: VisualControlState;
  worldViewMode: WorldViewMode;
  onAdvanceDay(): void;
  onChangeVisuals(nextVisuals: Partial<VisualControlState>): void;
  onChangeWorldMode(nextViewMode: WorldViewMode): void;
  onExport(): void;
  onImport(file: File): void;
  onPatch(path: (string | number)[], nextValue: unknown, label: string): void;
  onPlayPause(nextPlaying: boolean): void;
  onRandomizeSeed(): void;
  onTogglePanelPin(panelId: PanelId): void;
  onTogglePanel(panelId: PanelId): void;
  onTriggerDisturbance(type: 'wildfire' | 'drought' | 'logging' | 'parameter_shock'): void;
  onUndo(): void;
}

interface RelationListItem {
  directionLabel: string;
  id: string;
  label: string;
  sourceLabel: string;
  starred: boolean;
  styleLabel: string;
  targetLabel: string;
  typeLabel: string;
}

function NumberField({ label, onCommit, value }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <div className="field-card field">
      <label>{label}</label>
      <input
        type="number"
        step="0.01"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = Number(draft);
          if (!Number.isNaN(next)) {
            onCommit(next);
          } else {
            setDraft(String(value));
          }
        }}
      />
    </div>
  );
}

function SliderField({
  label,
  locked,
  max = 1,
  min = 0,
  onChange,
  onToggleLock,
  step = 0.01,
  value
}: SliderFieldProps) {
  return (
    <div className="field-card slider-field">
      <div className="slider-field__header">
        <label>{label}</label>
        <button type="button" className={['button', 'button--ghost', locked ? 'button--locked' : ''].join(' ')} onClick={onToggleLock}>
          {locked ? 'Locked' : 'Lock'}
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="slider-field__meta">
        <span>{min.toFixed(0)}</span>
        <strong>{value.toFixed(2)}</strong>
        <span>{max.toFixed(0)}</span>
      </div>
    </div>
  );
}

function PanelDrawer({
  children,
  copy,
  eyebrow,
  isPinned,
  isOpen,
  panelId,
  side,
  slot,
  tabLabel,
  title,
  onTogglePin,
  onToggle
}: PanelDrawerProps) {
  const handlePanelDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    if (target.closest('button,input,select,label,option,a')) {
      return;
    }

    onTogglePin(panelId);
  };

  const panel = (
    <div
      className={[
        'drawer-surface',
        `drawer-surface--${side}`,
        isOpen ? 'drawer-surface--open' : '',
        isPinned ? 'drawer-surface--pinned' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        id={`${panelId}-panel`}
        className={[
          'panel',
          'side-panel',
          `side-panel--${side}`,
          isPinned ? 'side-panel--pinned' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        onDoubleClick={handlePanelDoubleClick}
      >
        <div className="panel-header">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="side-title">{title}</h2>
          <p className="panel-copy">{copy}</p>
          <p className="panel-hint">
            {isPinned ? 'Pinned open. Scene clicks will not hide this panel.' : 'Double-click the panel background to keep it open.'}
          </p>
        </div>
        {children}
      </div>
    </div>
  );

  const tab = (
    <button
      type="button"
      className={['panel-tab', `panel-tab--${side}`, isOpen ? 'panel-tab--open' : ''].filter(Boolean).join(' ')}
      onClick={() => onToggle(panelId)}
      aria-label={tabLabel ?? title}
      aria-expanded={isOpen}
      aria-controls={`${panelId}-panel`}
      aria-pressed={isPinned}
    >
      <span className="panel-tab__label">{tabLabel ?? title}</span>
    </button>
  );

  return (
    <section
      className={[
        'panel-drawer',
        `panel-drawer--${side}`,
        `panel-drawer--${slot}`,
        isOpen ? 'panel-drawer--open' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {tab}
      {panel}
    </section>
  );
}

function readNumericValue(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }

  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'default' in value &&
    typeof value.default === 'number'
  ) {
    return value.default;
  }

  return 0;
}

function formatSelectionLabel(selection?: SelectionOverlay) {
  if (!selection) {
    return 'Nothing selected';
  }

  return `${selection.label}${selection.starred ? ' *' : ''}`;
}

function humanizeToken(value: string | undefined) {
  if (!value) {
    return '';
  }

  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function collectParameterNotes(parameters: Record<string, unknown> | undefined) {
  const notes = new Set<string>();

  if (!parameters) {
    return [];
  }

  Object.values(parameters).forEach((parameter) => {
    if (isRecord(parameter) && typeof parameter.notes === 'string') {
      notes.add(parameter.notes);
    }
  });

  return [...notes];
}

function describeEvidenceTier(rawBundle: RawContentBundle, tierId: string | undefined) {
  if (!tierId) {
    return undefined;
  }

  const tier = rawBundle.evidence_tiers[tierId];

  if (!isRecord(tier)) {
    return humanizeToken(tierId);
  }

  if (typeof tier.description === 'string') {
    return `${humanizeToken(tierId)}: ${tier.description}`;
  }

  if (typeof tier.meaning === 'string') {
    return `${humanizeToken(tierId)}: ${tier.meaning}`;
  }

  return humanizeToken(tierId);
}

function toRelationListItem(
  bundle: NormalizedBundle,
  relation: NormalizedBundle['relations'][number],
  directionLabel: string
): RelationListItem {
  return {
    id: relation.id,
    label: relation.description ?? humanizeToken(relation.type),
    sourceLabel: bundle.entityIndex[relation.from]?.displayLabel ?? humanizeToken(relation.from),
    targetLabel: bundle.entityIndex[relation.to]?.displayLabel ?? humanizeToken(relation.to),
    styleLabel: humanizeToken(relation.styleId),
    typeLabel: humanizeToken(relation.type),
    directionLabel,
    starred: relation.starred
  };
}

export function ControlPanel({
  backendLabel,
  bundle,
  panelStates,
  playing,
  rawBundle,
  selection,
  snapshot,
  status,
  visuals,
  worldViewMode,
  onAdvanceDay,
  onChangeVisuals,
  onChangeWorldMode,
  onExport,
  onImport,
  onPatch,
  onPlayPause,
  onRandomizeSeed,
  onTogglePanelPin,
  onTogglePanel,
  onTriggerDisturbance,
  onUndo
}: ControlPanelProps) {
  const selectedAnchorIndex = selection?.kind === 'anchor' ? snapshot?.anchorIds.indexOf(selection.id) ?? -1 : -1;
  const selectedEntityId =
    selectedAnchorIndex >= 0 && snapshot ? snapshot.anchorEntityTypes[selectedAnchorIndex] : undefined;
  const selectedEntity = selectedEntityId ? bundle.entityIndex[selectedEntityId] : undefined;
  const selectedEntityRawIndex = rawBundle.entity_catalog.findIndex((entity) => entity.id === selectedEntityId);
  const selectedEntityRaw =
    selectedEntityRawIndex >= 0 ? (rawBundle.entity_catalog[selectedEntityRawIndex] as Record<string, unknown>) : undefined;
  const selectedAnchorLabel = selectedAnchorIndex >= 0 && snapshot ? snapshot.anchorLabels[selectedAnchorIndex] : undefined;
  const selectedRelationRawIndex =
    selection?.kind === 'relation'
      ? rawBundle.relation_catalog.findIndex((relation) => relation.id === selection.id)
      : -1;
  const selectedRelation = selection?.kind === 'relation' ? bundle.relationIndex[selection.id] : undefined;
  const selectedRelationRaw =
    selectedRelationRawIndex >= 0 ? (rawBundle.relation_catalog[selectedRelationRawIndex] as Record<string, unknown>) : undefined;
  const worldPreset = rawBundle.world_presets[0];
  const selectedCohortNote = worldPreset.cohort_defaults.find((item) => item.entity_id === selectedEntityId)?.notes;

  const connectedRelationCount = useMemo(() => {
    if (!selection || !snapshot) {
      return 0;
    }

    if (selection.kind === 'anchor') {
      return snapshot.relationSourceAnchorIds.reduce((count, sourceAnchorId, index) => {
        const targetAnchorId = snapshot.relationTargetAnchorIds[index];
        return sourceAnchorId === selection.id || targetAnchorId === selection.id ? count + 1 : count;
      }, 0);
    }

    return 1;
  }, [selection, snapshot]);

  const selectedRelationEndpoints = useMemo(() => {
    if (!selection || selection.kind !== 'relation' || !snapshot) {
      return undefined;
    }

    const relationIndex = snapshot.relationIds.indexOf(selection.id);

    if (relationIndex === -1) {
      return undefined;
    }

    return {
      source: snapshot.relationSourceAnchorIds[relationIndex] ?? 'unknown',
      target: snapshot.relationTargetAnchorIds[relationIndex] ?? 'unknown'
    };
  }, [selection, snapshot]);

  const selectedEntityKind =
    typeof selectedEntityRaw?.kind === 'string'
      ? selectedEntityRaw.kind
      : selectedEntity?.kind;
  const selectedEntityScale = selectedEntity?.organisationScale.checkpointId;
  const selectedEntityPosition = selectedEntity?.organisationScale.position01;
  const selectedEntityVisibleRange = selectedEntity?.organisationScale.visibleRange01;
  const selectedRelationTier = selectedRelation?.evidenceTier ?? (
    typeof selectedRelationRaw?.evidence_tier_override === 'string' ? selectedRelationRaw.evidence_tier_override : undefined
  );
  const selectedEntityNotes = [
    ...(Array.isArray(selectedEntityRaw?.latin_names) && selectedEntityRaw.latin_names.length > 0
      ? [`Latin names: ${selectedEntityRaw.latin_names.join(', ')}`]
      : []),
    ...(typeof selectedCohortNote === 'string'
      ? [selectedCohortNote]
      : []),
    ...collectParameterNotes(
      isRecord(selectedEntityRaw?.parameters) ? selectedEntityRaw.parameters : undefined
    ).slice(0, 3)
  ];
  const selectedRelationNotes = [
    typeof selectedRelationRaw?.mechanism === 'string' ? `Mechanism: ${selectedRelationRaw.mechanism}` : undefined,
    describeEvidenceTier(rawBundle, selectedRelationTier),
    Array.isArray(selectedRelation?.evidence) && selectedRelation.evidence.length > 0
      ? `Evidence sources: ${selectedRelation.evidence.slice(0, 3).join(', ')}`
      : undefined
  ].filter((note): note is string => Boolean(note));
  const ecologyHeadline = selection
    ? `${selection.label}${selection.starred ? ' *' : ''}`
    : 'Ecology info';
  const ecologySubheading = !selection
    ? 'Select a feature in the scene to inspect its ecology, notes, and relations.'
    : selection.kind === 'anchor'
      ? humanizeToken(selectedEntityKind ?? selection.kind)
      : humanizeToken(selectedRelation?.type ?? selection.kind);
  const ecologyDescription =
    selection?.kind === 'anchor' && selectedEntity?.description
      ? selectedEntity.description
      : selection?.kind === 'relation' && selectedRelation?.description
        ? selectedRelation.description
        : rawBundle.purpose;
  const ecologyNotes =
    selection?.kind === 'anchor'
      ? selectedEntityNotes
      : selection?.kind === 'relation'
        ? selectedRelationNotes
        : rawBundle.design_notes.slice(0, 3);
  const anchorInfoCards = selection?.kind === 'anchor'
    ? [
        { label: 'Organisation checkpoint', value: humanizeToken(selectedEntityScale) || 'Unknown' },
        { label: 'Organisation position', value: typeof selectedEntityPosition === 'number' ? selectedEntityPosition.toFixed(2) : 'Unknown' },
        {
          label: 'Visible range',
          value: selectedEntityVisibleRange ? `${selectedEntityVisibleRange[0].toFixed(2)} - ${selectedEntityVisibleRange[1].toFixed(2)}` : 'Unknown'
        },
        { label: 'Legacy scale', value: humanizeToken(selectedEntity?.legacyScale) || 'None' },
        { label: 'Linked relations', value: String(connectedRelationCount) },
        ...(selectedAnchorLabel ? [{ label: 'Scene anchor', value: selectedAnchorLabel }] : [])
      ]
    : [];
  const relationInfoCards = selection?.kind === 'relation'
    ? [
        { label: 'Relation type', value: humanizeToken(selectedRelation?.type ?? selection.kind) || 'Unknown' },
        { label: 'Trail style', value: humanizeToken(selectedRelation?.styleId) || 'Unknown' },
        { label: 'Source', value: selectedRelationEndpoints?.source ?? 'Unknown' },
        { label: 'Target', value: selectedRelationEndpoints?.target ?? 'Unknown' },
        { label: 'Support sign', value: humanizeToken(selectedRelation?.supportSign) || 'Unknown' },
        { label: 'Evidence refs', value: String(selectedRelation?.evidence.length ?? 0) }
      ]
    : [];
  const ecologyInfoCards = selection?.kind === 'anchor' ? anchorInfoCards : selection?.kind === 'relation' ? relationInfoCards : [];
  const directRelations = useMemo(() => {
    if (selection?.kind === 'anchor' && selectedEntityId) {
      return bundle.relations
        .filter((relation) => relation.from === selectedEntityId || relation.to === selectedEntityId)
        .map((relation) =>
          toRelationListItem(
            bundle,
            relation,
            relation.from === selectedEntityId
              ? 'Outgoing'
              : relation.to === selectedEntityId
                ? 'Incoming'
                : 'Linked'
          )
        );
    }

    if (selection?.kind === 'relation' && selectedRelation) {
      return [toRelationListItem(bundle, selectedRelation, 'Selected relation')];
    }

    return [];
  }, [bundle, selectedEntityId, selectedRelation, selection]);
  const contextualRelations = useMemo(() => {
    if (!selection) {
      return [];
    }

    const directIds = new Set(directRelations.map((relation) => relation.id));
    const bridgeEntityIds = new Set<string>();

    if (selection.kind === 'anchor' && selectedEntityId) {
      bridgeEntityIds.add(selectedEntityId);
      bundle.relations.forEach((relation) => {
        if (relation.from === selectedEntityId) {
          bridgeEntityIds.add(relation.to);
        }
        if (relation.to === selectedEntityId) {
          bridgeEntityIds.add(relation.from);
        }
      });
    }

    if (selection.kind === 'relation' && selectedRelation) {
      bridgeEntityIds.add(selectedRelation.from);
      bridgeEntityIds.add(selectedRelation.to);
    }

    return bundle.relations
      .filter((relation) => !directIds.has(relation.id))
      .filter((relation) => bridgeEntityIds.has(relation.from) || bridgeEntityIds.has(relation.to))
      .map((relation) =>
        toRelationListItem(
          bundle,
          relation,
          bridgeEntityIds.has(relation.from) && bridgeEntityIds.has(relation.to)
            ? 'Context'
            : bridgeEntityIds.has(relation.from)
              ? `From ${bundle.entityIndex[relation.from]?.displayLabel ?? humanizeToken(relation.from)}`
              : `To ${bundle.entityIndex[relation.to]?.displayLabel ?? humanizeToken(relation.to)}`
        )
      );
  }, [bundle, directRelations, selectedEntityId, selectedRelation, selection]);
  const directNestedChildren = useMemo(
    () =>
      selectedEntityId
        ? bundle.nestedLinks.filter((link) => link.parent === selectedEntityId)
        : [],
    [bundle.nestedLinks, selectedEntityId]
  );
  const directNestedParents = useMemo(
    () =>
      selectedEntityId
        ? bundle.nestedLinks.filter((link) => link.child === selectedEntityId)
        : [],
    [bundle.nestedLinks, selectedEntityId]
  );
  const selectedEntityTypeDetails = selection?.kind === 'anchor'
    ? [
        {
          label: 'Type',
          value: humanizeToken(selectedEntityKind ?? selection.kind) || 'Unknown'
        },
        ...(selectedEntity?.kindBranch ? [{ label: 'Branch', value: humanizeToken(selectedEntity.kindBranch) }] : [])
      ]
    : [];

  return (
    <aside className="control-panel">
      <PanelDrawer
        copy="Advance the ecological clocks, reseed the current world mode, and trigger disturbances without leaving the full-screen scene."
        eyebrow="Runtime"
        isOpen={panelStates.simulation.open}
        isPinned={panelStates.simulation.pinned}
        panelId="simulation"
        side="left"
        slot="upper"
        title="Simulation controls"
        tabLabel="Simulation controls"
        onTogglePin={onTogglePanelPin}
        onToggle={onTogglePanel}
      >
        <div className="section">
          <div className="button-row">
            <span className="badge">Renderer: {backendLabel}</span>
            <span className="badge">World: {worldViewMode === 'tuning_standard' ? 'Standard tuning' : 'Hectare patch'}</span>
            <span className="badge">Selection: {formatSelectionLabel(selection)}</span>
          </div>
          <p className="status-line">{status}</p>
        </div>

        <div className="section">
          <div className="button-row">
            <button className="button button--primary" onClick={() => onPlayPause(!playing)}>
              {playing ? 'Pause simulation' : 'Play simulation'}
            </button>
            <button className="button" onClick={onAdvanceDay}>
              Advance day
            </button>
            <button className="button" onClick={onRandomizeSeed}>
              Reseed world
            </button>
            <button className="button" onClick={onUndo}>
              Undo last edit
            </button>
          </div>
          {snapshot ? (
            <div className="metric-grid">
              <div className="metric-card">
                <span className="metric-label">Day</span>
                <span className="metric-value">{snapshot.metrics.currentDay}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Phase</span>
                <span className="metric-value">{snapshot.metrics.phase}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Moisture</span>
                <span className="metric-value">{snapshot.metrics.moisture.toFixed(2)}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Disturbance</span>
                <span className="metric-value">{snapshot.metrics.disturbancePressure.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="empty-state">Waiting for the first simulation snapshot.</p>
          )}
        </div>

        <div className="section">
          <h3>Disturbance</h3>
          <div className="button-row">
            <button className="button button--danger" onClick={() => onTriggerDisturbance('wildfire')}>
              Wildfire
            </button>
            <button className="button button--danger" onClick={() => onTriggerDisturbance('drought')}>
              Drought
            </button>
            <button className="button button--danger" onClick={() => onTriggerDisturbance('logging')}>
              Logging
            </button>
            <button className="button button--danger" onClick={() => onTriggerDisturbance('parameter_shock')}>
              Parameter shock
            </button>
          </div>
        </div>
      </PanelDrawer>

      <PanelDrawer
        copy="Switch between the compact one-of-each tuning scene and the hectare comparison view, then tune the canonical old-growth preset values."
        eyebrow="Patch defaults"
        isOpen={panelStates.world.open}
        isPinned={panelStates.world.pinned}
        panelId="world"
        side="left"
        slot="lower"
        title="World generation"
        tabLabel="World generation"
        onTogglePin={onTogglePanelPin}
        onToggle={onTogglePanel}
      >
        <div className="section">
          <div className="field-card field">
            <label>World mode</label>
            <select value={worldViewMode} onChange={(event) => onChangeWorldMode(event.target.value as WorldViewMode)}>
              <option value="tuning_standard">Standard tuning scene</option>
              <option value="hectare_patch">Hectare patch</option>
            </select>
          </div>
        </div>
        <div className="section">
          <div className="field-grid">
            {Object.entries(worldPreset.tunable_world_parameters).map(([key, value]) => (
              <NumberField
                key={key}
                label={humanizeToken(key)}
                value={readNumericValue(value)}
                onCommit={(nextValue) =>
                  onPatch(['world_presets', 0, 'tunable_world_parameters', key, 'default'], nextValue, `Update ${key}`)
                }
              />
            ))}
          </div>
        </div>
      </PanelDrawer>

      <PanelDrawer
        copy="Click a point-cloud entity or transfer particle stream to inspect it. Weak links only reveal their star in text and metadata."
        eyebrow="Inspection"
        isOpen={panelStates.inspector.open}
        isPinned={panelStates.inspector.pinned}
        panelId="inspector"
        side="right"
        slot="upper"
        title="Selection inspector"
        tabLabel="Selection inspector"
        onTogglePin={onTogglePanelPin}
        onToggle={onTogglePanel}
      >
        <div className="section">
          {!selection ? (
            <p className="empty-state">
              Nothing is selected yet. Pick a world element in the scene to inspect parameters, evidence, and relation
              styling.
            </p>
          ) : (
            <>
              <div className="metric-grid">
                <div className="metric-card">
                  <span className="metric-label">Selected</span>
                  <span className="metric-value">{formatSelectionLabel(selection)}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Subtitle</span>
                  <span className="metric-value">{selection.subtitle ?? 'Inspectable runtime object'}</span>
                </div>
              </div>

              {selection.kind === 'anchor' && selectedEntity && selectedEntityRawIndex >= 0 ? (
                <div className="field-grid">
                  {Object.entries(selectedEntity.parameters)
                    .filter(([, parameter]) => typeof parameter.default === 'number')
                    .slice(0, 4)
                    .map(([key, parameter]) => (
                      <NumberField
                        key={key}
                        label={`${selectedEntity.displayLabel}: ${key}`}
                        value={Number(parameter.default ?? 0)}
                        onCommit={(nextValue) =>
                          onPatch(
                            ['entity_catalog', selectedEntityRawIndex, 'parameters', key, 'default'],
                            nextValue,
                            `Update ${selectedEntity.displayLabel} ${key}`
                          )
                        }
                      />
                    ))}
                </div>
              ) : null}

              {selection.kind === 'relation' && selectedRelationRawIndex >= 0 ? (
                <div className="field-grid">
                  <div className="field-card field">
                    <label>Trail style override</label>
                    <select
                      value={
                        (rawBundle.relation_catalog[selectedRelationRawIndex] as { style_id?: string }).style_id ??
                        bundle.relationIndex[selection.id]?.styleId
                      }
                      onChange={(event) =>
                        onPatch(
                          ['relation_catalog', selectedRelationRawIndex, 'style_id'],
                          event.target.value,
                          `Override ${selection.label} style`
                        )
                      }
                    >
                      {relationTrailStyleIds.map((styleId) => (
                        <option key={styleId} value={styleId}>
                          {styleId}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-card field">
                    <label>Evidence tier override</label>
                    <select
                      value={
                        (rawBundle.relation_catalog[selectedRelationRawIndex] as { evidence_tier_override?: string })
                          .evidence_tier_override ?? 'attached_synthesis'
                      }
                      onChange={(event) =>
                        onPatch(
                          ['relation_catalog', selectedRelationRawIndex, 'evidence_tier_override'],
                          event.target.value,
                          `Override ${selection.label} evidence tier`
                        )
                      }
                    >
                      {Object.keys(rawBundle.evidence_tiers).map((evidenceTier) => (
                        <option key={evidenceTier} value={evidenceTier}>
                          {evidenceTier}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {selection.details ? (
                <div className="metric-grid">
                  {Object.entries(selection.details).map(([key, value]) => (
                    <div key={key} className="metric-card">
                      <span className="metric-label">{key}</span>
                      <span className="metric-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </PanelDrawer>

      <PanelDrawer
        copy={ecologySubheading}
        eyebrow={selection ? humanizeToken(selection.kind) : 'Ecology'}
        isOpen={panelStates.ecology.open}
        isPinned={panelStates.ecology.pinned}
        panelId="ecology"
        side="right"
        slot="lower"
        tabLabel="Ecology info"
        title={ecologyHeadline}
        onTogglePin={onTogglePanelPin}
        onToggle={onTogglePanel}
      >
        <div className="section ecology-body">
          {selectedEntityTypeDetails.length > 0 ? (
            <div className="ecology-block">
              <div className="metric-grid">
                {selectedEntityTypeDetails.map((item) => (
                  <div key={item.label} className="metric-card">
                    <span className="metric-label">{item.label}</span>
                    <span className="metric-value">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="ecology-block">
            <h3>Ecology info</h3>
            <p className="panel-copy ecology-text">{ecologyDescription}</p>
          </div>

          {ecologyNotes.length > 0 ? (
            <div className="ecology-block">
              <h3>Notes</h3>
              <ul className="note-list">
                {ecologyNotes.map((note) => (
                  <li key={note} className="note-card">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {selection?.kind === 'anchor' && ecologyInfoCards.length > 0 ? (
          <div className="section">
            <h3>Organisation scale</h3>
            <div className="metric-grid">
              {ecologyInfoCards.map((item) => (
                <div key={item.label} className="metric-card">
                  <span className="metric-label">{item.label}</span>
                  <span className="metric-value">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selection?.kind === 'relation' && ecologyInfoCards.length > 0 ? (
          <div className="section">
            <h3>Relation details</h3>
            <div className="metric-grid">
              {ecologyInfoCards.map((item) => (
                <div key={item.label} className="metric-card">
                  <span className="metric-label">{item.label}</span>
                  <span className="metric-value">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selection?.kind === 'anchor' ? (
          <div className="section">
            <h3>Nesting</h3>
            {directNestedParents.length > 0 || directNestedChildren.length > 0 ? (
              <ul className="relation-list">
                {directNestedParents.map((link) => (
                  <li key={link.id} className="relation-card relation-card--context">
                    <strong>{bundle.entityIndex[link.parent]?.displayLabel ?? humanizeToken(link.parent)}</strong>
                    <span className="relation-meta">Contains this feature</span>
                    <span className="relation-meta">{humanizeToken(link.linkType)}</span>
                  </li>
                ))}
                {directNestedChildren.map((link) => (
                  <li key={link.id} className="relation-card">
                    <strong>{bundle.entityIndex[link.child]?.displayLabel ?? humanizeToken(link.child)}</strong>
                    <span className="relation-meta">Nested within this feature</span>
                    <span className="relation-meta">{humanizeToken(link.linkType)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No direct nesting links were found for this selection.</p>
            )}
          </div>
        ) : null}

        {selection?.kind === 'anchor' && selectedEntity ? (
          <div className="section">
            <h3>Allowed nesting</h3>
            <div className="metric-grid">
              <div className="metric-card">
                <span className="metric-label">Allowed containers</span>
                <span className="metric-value">
                  {selectedEntity.allowedContainerKindIds.length > 0
                    ? selectedEntity.allowedContainerKindIds.map(humanizeToken).join(', ')
                    : 'None listed'}
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Allowed children</span>
                <span className="metric-value">
                  {selectedEntity.allowedNestedChildKindIds.length > 0
                    ? selectedEntity.allowedNestedChildKindIds.map(humanizeToken).join(', ')
                    : 'None listed'}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {selection ? (
          <div className="section">
            <h3>Direct ecological relations</h3>
            {directRelations.length > 0 ? (
              <ul className="relation-list">
                {directRelations.map((relation) => (
                  <li key={relation.id} className="relation-card">
                    <strong>
                      {relation.label}
                      {relation.starred ? ' *' : ''}
                    </strong>
                    <span className="relation-meta">
                      {relation.sourceLabel} -&gt; {relation.targetLabel}
                    </span>
                    <span className="relation-meta">
                      {relation.typeLabel} · {relation.styleLabel} · {relation.directionLabel}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No bundled relations were found for this selection.</p>
            )}
          </div>
        ) : null}

        {selection ? (
          <div className="section">
            <h3>Context through connected features</h3>
            {contextualRelations.length > 0 ? (
              <ul className="relation-list">
                {contextualRelations.map((relation) => (
                  <li key={relation.id} className="relation-card relation-card--context">
                    <strong>
                      {relation.label}
                      {relation.starred ? ' *' : ''}
                    </strong>
                    <span className="relation-meta">
                      {relation.sourceLabel} -&gt; {relation.targetLabel}
                    </span>
                    <span className="relation-meta">
                      {relation.typeLabel} · {relation.styleLabel} · {relation.directionLabel}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No one-hop contextual relations were found around this selection.</p>
            )}
          </div>
        ) : null}

        {!selection ? (
          <div className="section">
            <div className="metric-grid">
              <div className="metric-card">
                <span className="metric-label">Entities</span>
                <span className="metric-value">{bundle.entities.length}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Relations</span>
                <span className="metric-value">{bundle.relations.length}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Organisation checkpoints</span>
                <span className="metric-value">{bundle.organisationCheckpoints.length}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Nested links</span>
                <span className="metric-value">{bundle.nestedLinks.length}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Starred links</span>
                <span className="metric-value">
                  {bundle.entities.filter((entity) => entity.starred).length +
                    bundle.relations.filter((relation) => relation.starred).length}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="section">
          <h3>Import / export</h3>
          <div className="button-row">
            <button className="button" onClick={onExport}>
              Export JSON bundle
            </button>
            <label className="button">
              Import JSON bundle
              <input
                hidden
                accept="application/json"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onImport(file);
                  }
                }}
              />
            </label>
          </div>
        </div>
      </PanelDrawer>

      <PanelDrawer
        copy="Tune the point budget, focus plane, DOF, glow, and transparency. Mouse-wheel zoom still couples camera zoom and holarchy depth unless one is locked."
        eyebrow="Render controls"
        isOpen={panelStates.visuals.open}
        isPinned={panelStates.visuals.pinned}
        panelId="visuals"
        side="bottom"
        slot="center"
        title="Visuals"
        tabLabel="Visuals"
        onTogglePin={onTogglePanelPin}
        onToggle={onTogglePanel}
      >
        <div className="section visuals-grid">
          <SliderField
            label="Camera zoom"
            value={visuals.cameraZoom}
            onChange={(cameraZoom) => onChangeVisuals({ cameraZoom })}
            locked={visuals.lockCameraZoom}
            onToggleLock={() => onChangeVisuals({ lockCameraZoom: !visuals.lockCameraZoom })}
          />
          <SliderField
            label="Holarchy visible"
            value={visuals.holarchyDepth}
            onChange={(holarchyDepth) => onChangeVisuals({ holarchyDepth })}
            locked={visuals.lockHolarchyDepth}
            onToggleLock={() => onChangeVisuals({ lockHolarchyDepth: !visuals.lockHolarchyDepth })}
          />
        </div>
        <div className="section">
          <div className="field-inline">
            <div className="field-card field">
              <label>Point budget preset</label>
              <select
                value={visuals.pointBudgetPreset}
                onChange={(event) =>
                  onChangeVisuals({
                    pointBudgetPreset: event.target.value as VisualControlState['pointBudgetPreset']
                  })
                }
              >
                {renderPointBudgetPresets.map((preset) => (
                  <option key={preset} value={preset}>
                    {humanizeToken(preset)}
                  </option>
                ))}
              </select>
            </div>
            <NumberField
              label="Max points"
              value={visuals.maxPoints}
              onCommit={(maxPoints) => onChangeVisuals({ maxPoints: Math.max(16_384, Math.round(maxPoints)) })}
            />
          </div>
          <div className="field-inline">
            <div className="field-card field">
              <label>DOF mode</label>
              <select
                value={visuals.dofMode}
                onChange={(event) =>
                  onChangeVisuals({
                    dofMode: event.target.value as VisualControlState['dofMode']
                  })
                }
              >
                <option value="off">Off</option>
                <option value="shader">Shader DOF</option>
                <option value="bokeh">Bokeh pass</option>
              </select>
            </div>
            <div className="field-card field">
              <label>Glow mode</label>
              <select
                value={visuals.glowMode}
                onChange={(event) =>
                  onChangeVisuals({
                    glowMode: event.target.value as VisualControlState['glowMode']
                  })
                }
              >
                <option value="off">Off</option>
                <option value="halo">Halo</option>
                <option value="bloom">Bloom</option>
              </select>
            </div>
          </div>
          <div className="field-inline">
            <div className="field-card field">
              <label>Focus lock</label>
              <select
                value={visuals.focusLock}
                onChange={(event) =>
                  onChangeVisuals({
                    focusLock: event.target.value as VisualControlState['focusLock']
                  })
                }
              >
                <option value="camera">Camera distance</option>
                <option value="selection">Selected item</option>
              </select>
            </div>
            <div className="field-card field">
              <label>Transparency</label>
              <select
                value={visuals.transparencyMode}
                onChange={(event) =>
                  onChangeVisuals({
                    transparencyMode: event.target.value as VisualControlState['transparencyMode']
                  })
                }
              >
                <option value="solid_core">Solid core</option>
                <option value="soft_alpha">Soft alpha</option>
              </select>
            </div>
          </div>
          <NumberField
            label="Focus distance"
            value={visuals.focusDistance}
            onCommit={(focusDistance) => onChangeVisuals({ focusDistance: Math.max(1, focusDistance) })}
          />
        </div>
      </PanelDrawer>
    </aside>
  );
}
