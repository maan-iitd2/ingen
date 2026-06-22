# inFlow sidebar → unified node-creator

**Date:** 2026-06-22
**Status:** Approved (design)
**Area:** `frontend/` — InGen Studio graph editor (inFlow view)

## Problem

The inFlow left sidebar (`GraphPalette` in `NavRail.jsx`) only has one working group —
**Transforms** (click/drag appends a `pre_processing` step). The other groups (**Sources**,
**Validation**, **Output**) are dead, info-only chips labelled "configured elsewhere". **Columns**
isn't in the sidebar at all — the only way to add/edit columns is to click the Columns node on the
canvas, which is unintuitive. Separately, the canvas toolbar has a redundant **"+ Add source"**
button that duplicates (badly) what the Sources group should do.

## Goal

Every sidebar category becomes a real, expandable add-menu whose leaves are **actionable**: clicking
a leaf adds the node with sensible defaults **and opens its config drawer** — the pattern Transforms
already uses. Menu contents are derived from the existing form schemas, so they always match what the
ingen backend supports. Nothing stale.

## Non-goals (deliberately not building)

- **No new config forms.** Reuse the existing drawers: `SourcesTab`, `ColumnsTab`, `ValidationsTab`,
  `OutputTab`, `SchemaForm`. The work is wiring + presentation, not new editors.
- **No per-expectation validation leaves, no auto-added validations.** Validations are *optional* in
  ingen: `validations.py` reads `column.get('validations', [])` (skipped if absent) and **0 of 3**
  sample configs use them. A single "Add validation" leaf that opens the existing drawer is enough.
- **No multi-output stacking.** Output is one writer per interface by backend design. Emitting
  multiple shapes is done via `splitted_file` / `json_writer`, surfaced as explicit leaves.
- **No drag for sources/validation/output.** Click is the reliable path; transform drag stays only
  because it already exists.

## Design

### Categories & leaves

All leaves are data-driven from existing schemas (single source of truth, always backend-accurate):

| Category | Leaves | Source of truth | Click action |
|---|---|---|---|
| **Sources** | Database (MySQL), File, API, JSON, Raw frame | `sourceSchemas.js` (`file`/`mysql`/`api`/`json`/`rawdatastore`) | add source w/ defaults → select node → open Sources drawer |
| **Transforms** | merge, union, outer_join, mask, melt, filters, … (unchanged) | `PRE_PROCESSOR_ORDER` | append `pre_processing` step → open its drawer (existing; keep click **and** drag) |
| **Columns** | **+ Add column** (with a one-line note) | n/a (single mapping node) | append blank column row → open Columns drawer |
| **Validations** | **Add validation** (single leaf) | n/a — drawer already has column + expectation + severity | open Validations drawer |
| **Output** | Delimited file, Excel, JSON, JSON writer, Raw frame, Splitted file | `OUTPUT_SCHEMAS` (6 types) | set `output.type` + defaults → open Output drawer |

- `file` source fans out to delimited/excel/xml/json/fixed_width via the drawer's `file_type` field —
  not as separate sidebar leaves (keeps the menu short; the variant is a one-field choice).
- All groups remain **collapsible dropdowns** (the existing chevron pattern). The palette's existing
  **search box** filters leaves across every category, Transforms included.

### Interaction: add-then-configure

Clicking a leaf:
1. Mutates the model via `ConfigContext` (`updateInterface` / `upsertSource`) with sensible defaults.
2. Selects the resulting node so the **existing** drawer opens for immediate configuration.

Keyboard (Enter/Space) and transform drag-to-canvas are preserved.

### Plumbing — `GraphSelectionContext` (the one new module)

`NavRail` (sidebar) and `InterfaceGraphEditor` (canvas) are siblings under `WorkspaceLayout` with no
shared selection. To let a sidebar click open the canvas drawer, lift `selectedNodeId` out of
`InterfaceGraphEditor` into a small context — a direct mirror of the existing `ChatSessionContext`:

- `selectedNodeId`, `setSelectedNodeId(id)` — shared selection.
- Provided at the workspace level (alongside the other providers).
- `InterfaceGraphEditor` reads/writes it instead of local `useState`; its drawer logic is unchanged.
- `NavRail` calls `setSelectedNodeId(newNodeId)` after adding a node.

New-node ids must be predictable so the sidebar can select them: sources → `src-<id>`, transforms →
`pre-<newIdx>`, columns → `columns-node`, output → `output-node`, validations → `validation-node`
(these id conventions already exist in `InterfaceGraphEditor`).

### Remove the redundant control

Delete the canvas toolbar **"+ Add source"** button and its `addingSource` modal path in
`InterfaceGraphEditor` — the Sources sidebar group replaces it. (Keep the underlying `addSource`
logic / `SourceLoader` reuse if the Sources drawer needs it; only the duplicate entry point goes.)

### Config-drawer polish (frontend-design, at implementation)

Presentation only, on the existing drawers: drawer title + one-line purpose, required fields first
with Advanced collapsed, consistent spacing, and helper text placed under its field. No logic change.

## Affected files

- `frontend/src/components/layout/NavRail.jsx` — rewrite `NODE_PALETTE` to be fully actionable +
  per-category click handlers.
- `frontend/src/components/editor/graph/InterfaceGraphEditor.jsx` — consume `GraphSelectionContext`;
  remove the "+ Add source" button + modal.
- `frontend/src/state/GraphSelectionContext.jsx` — **new**, mirrors `ChatSessionContext`.
- Provider wiring (workspace level — same place `ChatSessionContext` is provided).
- `index.css` — minor styles for newly-actionable leaves / notes (reuse existing palette classes).

## Edge cases

- **Multiple sources of different kinds** (e.g. JSON + CSV) — already supported by ingen; the sidebar
  makes adding the 2nd/3rd source first-class.
- **Multiple output shapes** — `splitted_file` / `json_writer` leaves + a note; no fake stacking.
- **Validation without columns** — the existing drawer already guards this ("Add columns first").
- **Adding a node that already exists as a singleton** (Columns/Output/Validation) — the leaf just
  selects + opens the existing node's drawer rather than creating a duplicate.

## Testing

- Unit: a small test that the palette config enumerates exactly the schema-supported types per
  category (guards against the menu drifting from `sourceSchemas` / `OUTPUT_SCHEMAS` /
  `PRE_PROCESSOR_ORDER`).
- Manual (frontend): click each leaf → correct node appears with defaults and its drawer opens;
  search filters all groups; "+ Add source" button is gone.
