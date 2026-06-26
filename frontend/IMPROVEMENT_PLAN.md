# InGen Studio — Frontend Improvement Plan & Technical Spec

> Comprehensive overhaul plan produced from a critical audit of the entire `frontend/src` codebase.
> Organized into **6 phases**, each self-contained with a clear deliverable.
> Total scope: ~34 items across bug fixes, UX gaps, graph editor overhaul, and new features.

---

## Table of Contents

1. [Phase 0 — Critical Bug Fixes (data-loss / correctness)](#phase-0--critical-bug-fixes)
2. [Phase 1 — Graph Editor Overhaul (n8n-quality canvas)](#phase-1--graph-editor-overhaul)
3. [Phase 2 — UX Completeness (missing affordances)](#phase-2--ux-completeness)
4. [Phase 3 — Chat & AI Polish](#phase-3--chat--ai-polish)
5. [Phase 4 — Technical Debt & Code Quality](#phase-4--technical-debt--code-quality)
6. [Phase 5 — New Features](#phase-5--new-features)
7. [File-by-File Change Map](#file-by-file-change-map)
8. [Dependency Changes](#dependency-changes)
9. [Testing Strategy](#testing-strategy)

---

## Phase 0 — Critical Bug Fixes

> **Goal:** Fix every issue that can lose user data or break core flow. Ship-blocking.

### 0.1 — Multi-source stale closure in `Start.jsx`

- **File:** `src/components/start/Start.jsx` lines 48-52
- **Bug:** `onChoose` calls `updateModel()` inside a `forEach` loop. Each call captures the
  same `model` from the closure, so only the last source survives — all others are silently dropped.
- **Fix:** Accumulate all mutations into a single `updateModel` call:
  ```js
  const onChoose = (view) => {
    updateModel((m) => {
      let next = m;
      pendingSources.forEach(({ source, columns }) => {
        next = upsertSource(next, source);
        const it = next.interfacesByName[interfaceName] ?? createEmptyInterface();
        next = upsertInterface(next, interfaceName, {
          ...it, sources: [...(it.sources ?? []), source.id],
        });
        setColumns(source.id, columns);
      });
      return next;
    });
    setViewMode(view);
    router.push(`/configs/${configId}/interfaces/${interfaceName}`);
  };
  ```
- **Test:** Add a test that creates 3 pending sources, calls `onChoose`, and asserts all 3
  appear in `model.sourceOrder` and in `interfacesByName[name].sources`.

### 0.2 — Chat stale-model race condition

- **File:** `src/components/editor/chat/InterfaceChatEditor.jsx` line 120
- **Bug:** `applyOps(model, ...)` uses `model` captured in the `useCallback` closure. If
  two messages overlap, the second op overwrites the first.
- **Fix:** Change `updateModel(() => nextModel)` to use the functional updater so it
  threads through the latest model:
  ```js
  // Instead of computing nextModel from the closed-over `model`, compute inside the updater:
  updateModel((currentModel) => {
    const { model: next } = applyOps(currentModel, interfaceName, knownColumns, ops);
    return next;
  });
  ```
  This also requires `applyOps` to accept the currentModel from the updater, not the
  stale closure. Refactor `handleSendMessage` accordingly.

### 0.3 — Destructive `BootGate` migration with no backup

- **File:** `src/app/BootGate.jsx` lines 17-24
- **Bug:** Bumping `DATA_VERSION` silently wipes all `ingen-studio:*` keys.
- **Fix:** Before wiping, export the old data as a JSON blob in a separate key
  (`ingen-studio:backup:<old_version>`), and show a one-time toast/banner informing the
  user their data was migrated. Add a "restore from backup" button in the pipeline index.
- **Minimal fix (do first):** At minimum, wrap the wipe in a `try/catch` and `console.warn`
  the old data before deleting.

### 0.4 — `window.confirm` blocked in iframe/Electron contexts

- **File:** `src/app/page.jsx` line 50
- **Fix:** Replace `window.confirm()` with a React-rendered confirmation dialog component.
  Create `src/components/common/ConfirmDialog.jsx` — a controlled modal with
  "Confirm" / "Cancel" buttons. Use it for both pipeline delete and history clear.

### 0.5 — Column store lost on tab close

- **File:** `src/lib/columnStore.js`
- **Bug:** Uses `sessionStorage` — column names vanish on tab close. The chat's
  `knownColumns` becomes empty with no user feedback.
- **Fix:** Migrate to `localStorage` with the same `ingen-studio` namespace (or persist
  columns directly in the `ConfigModel.sourcesById[id].detectedColumns` field so they
  travel with the config). If keeping separate, at minimum switch to `localStorage`.

---

## Phase 1 — Graph Editor Overhaul (n8n-quality canvas)

> **Goal:** Make the inFlow graph feel like n8n / Flowise — professional node-graph editing.

### Current state (from screenshot)

The ReactFlow canvas technically has zoom/pan/controls, but the experience is far from n8n:
- Nodes are cramped and hard to distinguish
- No snap-to-grid
- No node deletion from the canvas
- No multi-select / box selection
- No context menu (right-click)
- No undo/redo
- No edge deletion via backspace
- Controls widget is minimal
- No smooth bezier edge paths
- Auto-layout is rigid column-based, not dagre/elk
- 742-line monolith makes iteration hard

### 1.1 — Decompose `InterfaceGraphEditor.jsx` (742 lines → ~6 files)

Split into:
```
src/components/editor/graph/
├── InterfaceGraphEditor.jsx    (main component, ~150 lines)
├── nodes/
│   ├── SourceNode.jsx
│   ├── PreprocessNode.jsx
│   ├── ColumnsNode.jsx
│   ├── PostprocessNode.jsx
│   ├── ValidationsNode.jsx
│   └── OutputNode.jsx
├── Drawer.jsx                  (property panel)
├── useGraphLayout.js           (layout computation hook)
├── useGraphConnections.js      (onConnect, onEdgesDelete, isValidConnection)
├── graphConstants.js           (STAGE colors, SOURCE_CONSUMERS, nodeTypes)
└── ContextMenu.jsx             (right-click menu)
```

### 1.2 — n8n-style canvas interactions

| Feature | Current | Target | Implementation |
|---------|---------|--------|----------------|
| **Pan** | Mouse drag on bg | Same | Already works via ReactFlow defaults |
| **Zoom** | Scroll wheel | Scroll + ctrl+scroll + pinch + buttons | Enable `zoomOnScroll`, add zoom-to-fit button |
| **Snap to grid** | None | 20px snap grid | `snapToGrid snapGrid={[20, 20]}` on `<ReactFlow>` |
| **Multi-select** | None | Box select + shift-click | `selectionOnDrag` prop, add `onSelectionChange` |
| **Delete selected** | None | Backspace/Delete key | `deleteKeyCode="Backspace"` + `onNodesDelete` handler |
| **Node drag** | Works | Smooth with guides | `nodesDraggable` (already true) + alignment guides via `@reactflow/node-resizer` or custom |
| **Edge type** | Default straight | Smooth step / bezier | Set `defaultEdgeOptions={{ type: 'smoothstep' }}` |
| **Edge deletion** | Only via `onEdgesDelete` | Click edge → highlight → backspace | Already supported, ensure `elementsSelectable` |
| **Context menu** | None | Right-click on node/edge/canvas | Custom `onNodeContextMenu` / `onPaneContextMenu` |
| **Undo/Redo** | None | Ctrl+Z / Ctrl+Shift+Z | Model history stack (see 1.5) |
| **Copy/paste nodes** | None | Ctrl+C / Ctrl+V for transforms | Serialize selected → clipboard → paste with offset |

### 1.3 — Auto-layout with dagre

- **Install:** `dagre` (or `@dagrejs/dagre`) — lightweight directed-graph layout
- **Trigger:** On initial mount and via a "Auto Layout" button in the toolbar
- **Config:** `rankdir: 'LR'`, `nodesep: 60`, `ranksep: 200` (left-to-right flow like n8n)
- **Preserve:** After auto-layout, user drags override until next auto-layout click
- **File:** `src/components/editor/graph/useGraphLayout.js`

### 1.4 — Context menu component

```
Right-click on node →  Edit | Duplicate | Delete | Disconnect all
Right-click on edge →  Delete connection
Right-click on canvas → Add source | Add transform | Auto layout | Fit view
```

- **File:** `src/components/editor/graph/ContextMenu.jsx`
- **Style:** Floating menu with `position: fixed`, backdrop blur, matches n8n's clean look

### 1.5 — Undo/Redo stack

- **File:** `src/state/ConfigContext.jsx` (or new `src/state/useModelHistory.js`)
- **Approach:** Maintain a stack of model snapshots (max 50). Each `updateModel` pushes.
  `undo()` pops. `redo()` restores from a forward stack.
- **UI:** Undo/Redo buttons in the graph toolbar + keyboard shortcuts
- **Scope:** Config-level (covers all edits, not just graph)

### 1.6 — Improved node visuals

- **Wider nodes:** Min-width 220px → 280px so text isn't truncated
- **Better spacing:** colWidth 270 → computed via dagre
- **Color coding:** Stronger left-border (4px → 5px), icon box larger (30px → 36px)
- **Connection ports:** Larger, with hover glow animation (n8n-style)
- **Edge labels:** Improve font size, add a small background pill
- **Selection ring:** Animated dashed border instead of static box-shadow

### 1.7 — Graph toolbar overhaul

Replace the current hint text blob with a proper toolbar:
```
[ Fit View ] [ Auto Layout ] [ Undo ] [ Redo ] | [ Zoom: 100% ] [ + ] [ - ]
```
- Add `useReactFlow()` hook for `fitView()`, `zoomIn()`, `zoomOut()`, `getZoom()`
- Show current zoom percentage
- "Fit View" button always visible

---

## Phase 2 — UX Completeness

> **Goal:** Fill every gap where the user hits a dead end or can't do something obvious.

### 2.1 — Pipeline rename

- **Where:** Pipeline index page (`src/app/page.jsx`) + brand bar portal
- **UI:** Click the pipeline name in the brand bar → inline editable text field
- **Model:** `updateModel((m) => ({ ...m, meta: { ...m.meta, name: newName } }))`

### 2.2 — Interface rename

- **Where:** Config index / interface list in the NavRail
- **UI:** Double-click interface name → inline edit
- **Model:** New `renameInterface(model, oldName, newName)` in `configModel.js` that:
  1. Creates a new key in `interfacesByName`
  2. Updates `interfaceOrder`
  3. Updates all cross-references (other interfaces' `sources` referencing rawdatastore output)

### 2.3 — Source deletion from UI

- **Where:** Graph drawer (when a source node is selected) + SourcesTab
- **UI:** "Delete source" button with confirmation
- **Model:** Already exists as `removeSource()` — just wire it to a button
- **Safety:** Warn if any interface still references the source

### 2.4 — Dead "/sources" route

- **Where:** `SourcesTab.jsx` line 78 links to `/configs/${id}/sources` which doesn't exist
- **Fix:** Either create the route (`src/app/configs/[configId]/sources/page.jsx`) as a
  standalone Sources registry view, or change the link to a tooltip explaining that sources
  are managed per-interface.

### 2.5 — Dropzone preview needs column headers

- **Where:** `SourceLoader.jsx` lines 159-168
- **Fix:** If `upload.rows[0]` exists, render it as `<thead>` with `<th>` elements. Slice
  data rows from index 1 onward.

### 2.6 — ValidationsTab dead-end: add navigation to ColumnsTab

- **Where:** `ValidationsTab.jsx` line 37
- **Fix:** Replace "Add columns first" text with a clickable link/button that sets
  `selectedNodeId('columns-node')` (in graph mode) to open the columns drawer.

### 2.7 — Restore Manual/tabbed view mode (or remove the reference)

- **Decision needed:** The brand bar only shows "inFlow" and "inChat". The comments in
  `InterfaceEditor.jsx` mention "Manual" as Phase 1, but it was removed.
- **Option A:** Add a third "Manual" tab that shows the old tabbed form layout (Sources →
  Columns → Post-processing → Validations → Output) as a linear vertical form.
- **Option B:** Remove all references to "Manual" mode. The graph drawer already surfaces
  every form — "Manual" is the graph with a node selected.
- **Recommendation:** Option B (less code, the graph drawer IS the manual mode). Clean up
  comments.

### 2.8 — `OverridesForm` missing `override_params` input

- **Where:** `OverridesForm.jsx`
- **Fix:** Add a JSON textarea field for `override_params` and `query_params`. Use the
  existing `JsonField` component. Wire into the `submit()` payload.

### 2.9 — History clear needs confirmation

- **Where:** `HistoryView.jsx` line 32
- **Fix:** Use the new `ConfirmDialog` from Phase 0.4.

### 2.10 — Per-route page titles

- **Where:** Each route page
- **Fix:** Use Next.js `useEffect` to set `document.title` with the config name and
  current view. E.g., `"interface_1 — Untitled pipeline — InGen Studio"`.

### 2.11 — YAML panel change highlighting

- **Where:** `YamlPreviewPanel.jsx`
- **Fix:** Diff the previous YAML lines against the new ones. Highlight changed/added lines
  with a subtle left-border or background flash. Use `useRef` to store previous lines and
  compare on each render.

---

## Phase 3 — Chat & AI Polish

### 3.1 — Markdown rendering in chat bubbles

- **Where:** `InterfaceChatEditor.jsx` line 143
- **Current:** `whiteSpace: pre-line` — doesn't render `**bold**` or backticks
- **Fix:** Add a lightweight markdown renderer. Options:
  - Simple: regex-based inline markdown (bold, code, links) — no dependency
  - Full: `react-markdown` (adds ~30KB) — overkill for chat bubbles
- **Recommendation:** Write a `<ChatMarkdown>` component that handles `**bold**`,
  `` `code` ``, and `\n` — ~30 lines, no dependency.

### 3.2 — `chatService.js` bypasses adapter pattern

- **Where:** `src/services/chatService.js`
- **Fix:** Move chat functionality into the adapter layer:
  - Create `src/adapters/httpChatAdapter.js` implementing a `ChatService`
  - Create `src/adapters/mockChatAdapter.js` (returns regex-parsed ops, no network)
  - Add `chat` to the `ServiceSet` in `src/adapters/index.js`
  - `InterfaceChatEditor` calls `getServices().chat.interpret(...)` instead of raw fetch

### 3.3 — Chat "explain current YAML" capability

- **Where:** `InterfaceChatEditor.jsx`
- **Fix:** Add an op type `explain` that doesn't mutate the model but returns a natural
  language summary. Add a suggestion chip "explain this pipeline".

### 3.4 — Chat avatars & polish

- Replace plain "U" / "AI" text with styled avatar circles (user initial / bot icon)
- Add a subtle entrance animation for new messages

---

## Phase 4 — Technical Debt & Code Quality

### 4.1 — Array-index React keys → stable IDs

- **Files:** `ColumnsTab.jsx` (line 181), `FormatterRow` (line 90)
- **Fix:** Add a `_uid` field to each column object when created (via `makeId('col')`).
  Use `col._uid` as the React key. The serializer already strips unknown keys when
  building YAML, so `_uid` won't leak.

### 4.2 — `JsonField` doesn't sync on external value change

- **File:** `src/forms/fields/Fields.jsx` line 112
- **Fix:** Add a `useEffect` that resets the local text buffer when `value` changes and
  the field is not focused (user isn't actively typing). Use a ref to track focus.

### 4.3 — `setTimeout` hack for selection after drop

- **File:** `InterfaceGraphEditor.jsx` line 586
- **Fix:** Use `requestAnimationFrame` or better, defer via `useEffect` on a state flag:
  ```js
  const [pendingSelect, setPendingSelect] = useState(null);
  useEffect(() => { if (pendingSelect) { setSelectedNodeId(pendingSelect); setPendingSelect(null); } }, [pendingSelect]);
  ```

### 4.4 — `NavRail` calls `getSessions()` on every render

- **File:** `src/components/layout/NavRail.jsx` line 237
- **Fix:** `useMemo` with a dependency on a version counter that increments when sessions
  change, or use `useEffect` + state to load sessions once and refresh on command.

### 4.5 — `HistoryView` duplicate load logic

- **File:** `src/components/run/HistoryView.jsx` lines 20-30
- **Fix:** Remove the separate `load` callback. Use a single `useEffect` that sets state,
  and expose a `refresh` that increments a counter dep.

### 4.6 — Chat history `li` elements missing accessibility

- **File:** `NavRail.jsx` line 256-264
- **Fix:** Change `<li onClick=...>` to `<li><button className="..." onClick=...>` or add
  `role="button" tabIndex={0} onKeyDown={...}`.

### 4.7 — `package.json` name should be `ingen-studio`

- **File:** `frontend/package.json`
- **Fix:** `"name": "ingen-studio"`

### 4.8 — Verify `lucide-react` version

- `lucide-react@^1.18.0` — verify this resolves correctly. The mainline releases may
  still be `0.x`. Run `npm ls lucide-react` and fix if needed.

---

## Phase 5 — New Features

### 5.1 — Import from YAML

- **Where:** Pipeline index page + new modal
- **UI:** "Import YAML" button → paste YAML or upload `.yml` file
- **Backend:** `yamlDeserializer.js` already exists — wire it to a modal that calls
  `yamlToModel()` and saves via `config.create()`

### 5.2 — Duplicate pipeline / interface

- **Pipeline:** On the index page, add a "Duplicate" button per row
- **Interface:** In the NavRail, add a "Duplicate" option
- **Model:** Deep-clone with new IDs

### 5.3 — Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Force save (bypass debounce) |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+Shift+R` | Open Run console |
| `Delete` / `Backspace` | Delete selected node/edge |
| `Escape` | Close drawer / deselect |

- **Implementation:** Global `useEffect` keydown handler in `AppShell` or a dedicated
  `useKeyboardShortcuts` hook.

### 5.4 — Optimistic pipeline creation

- **Where:** `src/app/page.jsx` `createPipeline()`
- **Fix:** Navigate immediately with a temporary model, then persist in the background.
  The `ConfigProvider` already handles the load-by-id flow.

---

## File-by-File Change Map

> Every file that will be touched, with the phase(s) that affect it.

| File | Phases | Nature |
|------|--------|--------|
| `src/components/start/Start.jsx` | 0.1 | Bug fix (single updateModel call) |
| `src/components/editor/chat/InterfaceChatEditor.jsx` | 0.2, 3.1, 3.3, 3.4 | Bug fix + markdown + explain |
| `src/app/BootGate.jsx` | 0.3 | Backup before wipe |
| `src/app/page.jsx` | 0.4, 2.1, 5.1, 5.2, 5.4 | ConfirmDialog, rename, import, duplicate |
| `src/lib/columnStore.js` | 0.5 | sessionStorage → localStorage |
| **`src/components/editor/graph/InterfaceGraphEditor.jsx`** | **1.1-1.7** | **Full decomposition + rewrite** |
| `src/components/editor/graph/nodes/*.jsx` | 1.1 | New files (extracted from monolith) |
| `src/components/editor/graph/Drawer.jsx` | 1.1 | New file |
| `src/components/editor/graph/useGraphLayout.js` | 1.3 | New file (dagre layout) |
| `src/components/editor/graph/useGraphConnections.js` | 1.1 | New file |
| `src/components/editor/graph/graphConstants.js` | 1.1 | New file |
| `src/components/editor/graph/ContextMenu.jsx` | 1.4 | New file |
| `src/state/ConfigContext.jsx` | 1.5, 2.1 | Undo/redo stack, rename |
| `src/index.css` | 1.2, 1.6, 1.7, 3.4 | Graph styles overhaul, context menu styles |
| `src/components/common/ConfirmDialog.jsx` | 0.4 | New file |
| `src/models/configModel.js` | 2.2, 2.3 | renameInterface, wire removeSource to UI |
| `src/components/editor/tabs/SourcesTab.jsx` | 2.3, 2.4 | Delete source button, fix dead link |
| `src/components/start/SourceLoader.jsx` | 2.5 | Header row in preview table |
| `src/components/editor/tabs/ValidationsTab.jsx` | 2.6 | Link to columns node |
| `src/components/editor/InterfaceEditor.jsx` | 2.7 | Clean up manual-mode references |
| `src/components/run/OverridesForm.jsx` | 2.8 | Add override_params / query_params fields |
| `src/components/run/HistoryView.jsx` | 2.9, 4.5 | ConfirmDialog, dedupe load |
| `src/components/yaml/YamlPreviewPanel.jsx` | 2.11 | Change highlighting |
| `src/services/chatService.js` | 3.2 | Refactor into adapter |
| `src/adapters/index.js` | 3.2 | Add chat adapter |
| `src/adapters/httpChatAdapter.js` | 3.2 | New file |
| `src/adapters/mockChatAdapter.js` | 3.2 | New file |
| `src/components/editor/tabs/ColumnsTab.jsx` | 4.1 | Stable keys |
| `src/forms/fields/Fields.jsx` | 4.2 | JsonField sync fix |
| `src/components/layout/NavRail.jsx` | 4.4, 4.6 | Memoize sessions, a11y fix |
| `src/components/layout/WorkspaceLayout.jsx` | 2.1 | Inline rename portal |
| `package.json` | 4.7, 4.8, 1.3 | Name fix, verify lucide, add dagre |

---

## Dependency Changes

| Package | Action | Phase | Reason |
|---------|--------|-------|--------|
| `dagre` or `@dagrejs/dagre` | **Add** | 1.3 | Auto-layout for graph nodes |
| `lucide-react` | **Verify/fix** version | 4.8 | `^1.18.0` may not resolve |

No other new deps needed. The context menu, undo/redo, markdown, and confirm dialog are
all implemented as hand-rolled components (no external libraries).

---

## Testing Strategy

### Unit tests (existing `node --test` runner)

| Test file | Covers |
|-----------|--------|
| `models/applyIntent.test.js` | Extend: test multi-op threading |
| `models/configModel.test.js` | **New:** test `renameInterface`, `removeSource` safety |
| `serializers/yamlSerializer.test.js` | Extend: round-trip with `_uid` stripping |
| `components/start/Start.test.js` | **New:** multi-source `onChoose` regression |
| `state/useModelHistory.test.js` | **New:** undo/redo stack correctness |

### Manual smoke test checklist

- [ ] Create pipeline → add 3 sources → all 3 survive `onChoose`
- [ ] Graph: drag node, snap to grid visible
- [ ] Graph: right-click node → context menu appears
- [ ] Graph: select node + press Delete → node removed
- [ ] Graph: Ctrl+Z undoes the last change
- [ ] Graph: box-select multiple nodes → delete all
- [ ] Chat: send overlapping messages → both ops applied correctly
- [ ] Chat: `**bold**` renders as bold
- [ ] Pipeline list: rename inline
- [ ] YAML panel: changed lines flash briefly
- [ ] Import YAML: paste valid YAML → pipeline created
- [ ] Reload page → columns from uploaded file still available

---

## Build Order (recommended)

```
Phase 0 (bugs)          → ~1 day    (ship-blocking, do first)
Phase 1.1 (decompose)   → ~1 day    (unblocks all other graph work)
Phase 1.2-1.4 (canvas)  → ~2 days   (n8n interactions, context menu)
Phase 1.5-1.7 (undo+ui) → ~1 day    (undo stack, toolbar, visuals)
Phase 2 (UX gaps)        → ~2 days   (rename, delete, routing, a11y)
Phase 3 (chat polish)    → ~1 day    (markdown, adapter, explain)
Phase 4 (tech debt)      → ~1 day    (keys, sync, dedup)
Phase 5 (new features)   → ~2 days   (import YAML, shortcuts, duplicate)
```

**Total estimated:** ~11 working days for a single developer.

---

*Document generated from a full audit of all 60+ source files in `frontend/src/`.*
