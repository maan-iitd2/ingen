# UX Overhaul: Sources, Columns, Node Palette & Add-button Fixes

The current UI has several usability issues: sources can't be added (the "Add" button is disconnected from where sources are actually defined), the column editor is hard to discover and visually cramped, and the graph palette is a flat unstyled list with no explanations of what each node does. This plan overhauls all of these to be polished and draw.io-inspired.

## User Review Required

> [!IMPORTANT]
> **Source creation flow**: Currently, sources must be created in a separate "Sources registry" page (`/configs/cfg_draft/sources`), and then referenced by id in the interface's Sources tab. The "add a source" dropdown in the Sources tab only shows sources that already exist in the registry. Should I:
> - **(A) Inline source creation** — let users create a source directly from the Sources tab (type a new id + pick a type, creates it in the registry AND adds it to the interface in one step)?
> - **(B) Keep the two-step flow** but make it more discoverable (add a prominent "Create new source" button that navigates to the registry, and then auto-selects it when returning)?

> [!IMPORTANT]
> **Node palette scope**: The palette currently has placeholder entries for "Database" and "CSV File" under Sources, and "GE Validations" / "File Output" under Validation/Output — but these are not draggable (sources, validations, and output are defined elsewhere). Should I:
> - **(A) Remove non-actionable entries** — only show transforms (which are actually draggable/clickable)?  
> - **(B) Keep them as context** but add clear visual distinction and tooltips explaining where they're configured?

## Open Questions

> [!NOTE]
> You mentioned a "draw.io panel" reference — from the screenshot, the key features are:
> 1. **Hover tooltips** showing a preview/description of what each item does
> 2. **Collapsible category groups** (Scratchpad, General, etc.)
> 3. **Search/filter** for finding nodes quickly
> I plan to implement all three. Let me know if there's anything specific you want added.

## Proposed Changes

### 1. Sources Tab — Inline Source Creation

Make it possible to create and add sources directly from the interface's Sources tab (no separate page navigation needed).

#### [MODIFY] [SourcesTab.jsx](file:///c:/VOLUME_D/Interns/BlackRock/ingen/frontend/src/components/editor/tabs/SourcesTab.jsx)
- Replace the current "pick from existing sources" dropdown with a **dual-mode add bar**:
  - **"Add existing"** dropdown (current behavior, for referencing already-defined sources)
  - **"Create new"** inline form: id field + type dropdown + "Create & Add" button — creates the source in the registry AND adds it to the interface in one click
- Add a visible CTA when no sources exist: "No sources yet — create one to get started"
- Show inline type-specific configuration (file path, db name, etc.) expandable on each row

---

### 2. Columns Tab — Redesigned Column Editor

Replace the current cramped table with a card-based, visually clear column editor.

#### [MODIFY] [ColumnsTab.jsx](file:///c:/VOLUME_D/Interns/BlackRock/ingen/frontend/src/components/editor/tabs/ColumnsTab.jsx)
- Replace table layout with **column cards** (one card per column mapping)
- Each card shows: source column → output column with a clear arrow
- Formatters shown as chips inside the card; click to expand inline editing
- Large, obvious **"+ Add Column"** button at the top and bottom
- Drag handle for reordering (using up/down buttons, matching existing pattern)
- Empty state with an illustrative prompt: "Map your first column"

---

### 3. Node Palette — Draw.io-Inspired Redesign

Redesign the graph sidebar palette with rich tooltips, collapsible groups, search, and clear visual hierarchy.

#### [MODIFY] [NavRail.jsx](file:///c:/VOLUME_D/Interns/BlackRock/ingen/frontend/src/components/layout/NavRail.jsx)
- **Search bar** at top: filters nodes by name/description
- **Collapsible groups** with chevron toggle (Sources, Transforms, Validation, Output)
- **Rich hover tooltips** for each node:
  - Title + short description of what the transform does
  - Which YAML fields it writes
  - Example usage hint
  - Styled as a floating card (like draw.io's shape preview)
- **Better visual cards** for each palette item:
  - Colored left border matching stage color
  - Icon + label + brief subtitle
  - Clear "addable" vs "info-only" distinction
- Add descriptions to `PRE_PROCESSOR_SCHEMAS` so each transform has tooltip content

#### [MODIFY] [preProcessorSchemas.js](file:///c:/VOLUME_D/Interns/BlackRock/ingen/frontend/src/forms/schemas/preProcessorSchemas.js)
- Add `description` and `hint` fields to each schema entry (powers the palette tooltips)

---

### 4. CSS — Complete Style Refresh for All Changed Components

#### [MODIFY] [index.css](file:///c:/VOLUME_D/Interns/BlackRock/ingen/frontend/src/index.css)
- **New `.palette-*` styles**: search bar, collapsible groups, tooltip card, node cards with colored borders
- **New `.colcard-*` styles**: card-based column editor with source→dest visual flow
- **Updated `.addbar` styles**: split add bar with "create new" section
- **Updated `.srccard` styles**: better empty states, inline creation form
- **Tooltip positioning**: floating card with arrow, backdrop blur, appear animation
- **Improved empty states**: illustrated, larger, more inviting

---

### 5. Manual Mode — Fix "Add" Button Behavior

The Sources tab "Add" button doesn't work because there are no pre-defined sources to select. Fix by enabling inline creation.

#### [MODIFY] [SourcesTab.jsx](file:///c:/VOLUME_D/Interns/BlackRock/ingen/frontend/src/components/editor/tabs/SourcesTab.jsx)
- (Same file as item 1) — the inline creation form is the fix

---

## Verification Plan

### Manual Verification
1. **Sources flow**: Open Manual → Sources tab → verify "Create new source" form appears → create a `file` source → verify it shows in the table AND in the YAML panel → verify it also appears in the Sources registry page
2. **Columns flow**: Switch to Columns tab → click "+ Add Column" → fill in source/dest names → add a formatter → verify card layout is clear and YAML updates
3. **Node palette**: Switch to Graph view → verify palette has search, collapsible groups → hover over "Merge" → verify tooltip with description appears → click "Merge" → verify it's added to the canvas
4. **Empty states**: Start fresh → verify all empty states show clear CTAs
5. **Cross-check YAML**: All operations should produce correct YAML in the live panel
