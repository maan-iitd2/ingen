# inFlow Sidebar Node-Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every inFlow left-sidebar category an actionable add-menu that adds a node with sensible defaults and opens its config drawer, replacing the dead info-chips and the redundant canvas "+ Add source" button.

**Architecture:** A new `GraphSelectionContext` (mirroring `ChatSessionContext`) shares `selectedNodeId` between the sidebar (`NavRail`) and the canvas (`InterfaceGraphEditor`), which are sibling components. The sidebar mutates the model via the existing `ConfigContext` helpers and then sets the selection so the canvas's existing drawer opens. Menu contents are derived from the existing form schemas so they never drift from backend support.

**Tech Stack:** Next.js 15 / React 19, reactflow v11, lucide-react icons. Tests run via `npm run test` (`node --test` over `src/**/*.test.js`).

## Global Constraints

- `@/*` import alias → `src/*`; existing files use relative imports — match the file you edit.
- Pure model mutations only via `models/configModel.js` + `models/interfaceOps.js` (return new objects; pass to `ConfigContext`).
- Node-id conventions already used by `InterfaceGraphEditor` (do not change): source → `src-<id>`, transform → `pre-<idx>`, columns → `columns-node`, output → `output-node`, validations → `validation-node`.
- Source types (from `forms/schemas/sourceSchemas.js`): `file`, `mysql`, `api`, `json`, `rawdatastore`.
- Output types (from `forms/schemas/outputSchemas.js`): `delimited_file`, `excel`, `json`, `json_writer`, `rawdatastore`, `splitted_file`.
- Frequent commits with DCO sign-off: `git commit -s`.

---

### Task 1: GraphSelectionContext + provider wiring

**Files:**
- Create: `frontend/src/state/GraphSelectionContext.jsx`
- Modify: `frontend/src/components/layout/AppShell.jsx:101-108`
- Test: `frontend/src/state/GraphSelectionContext.test.js`

**Interfaces:**
- Produces: `GraphSelectionProvider({ children })`, `useGraphSelection()` returning `{ selectedNodeId: string|null, setSelectedNodeId: (id: string|null) => void }`.

- [ ] **Step 1: Write the failing test**

```js
// frontend/src/state/GraphSelectionContext.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { GraphSelectionProvider, useGraphSelection } from './GraphSelectionContext.jsx';

test('exports a provider and a hook', () => {
  assert.equal(typeof GraphSelectionProvider, 'function');
  assert.equal(typeof useGraphSelection, 'function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- src/state/GraphSelectionContext.test.js`
Expected: FAIL — cannot find module `./GraphSelectionContext.jsx`.

- [ ] **Step 3: Write minimal implementation**

```jsx
// frontend/src/state/GraphSelectionContext.jsx
//  InGen Studio — GraphSelectionContext
//
//  Bridges the inFlow sidebar (NavRail) and the canvas (InterfaceGraphEditor), which live in
//  different branches of the tree. The sidebar adds a node, then sets the selection here so the
//  canvas opens that node's config drawer. Mirrors ChatSessionContext.

import { createContext, useContext, useState, useMemo } from 'react';

const GraphSelectionContext = createContext(null);

export function GraphSelectionProvider({ children }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const value = useMemo(() => ({ selectedNodeId, setSelectedNodeId }), [selectedNodeId]);
  return <GraphSelectionContext.Provider value={value}>{children}</GraphSelectionContext.Provider>;
}

export function useGraphSelection() {
  const ctx = useContext(GraphSelectionContext);
  if (!ctx) throw new Error('useGraphSelection must be used within a GraphSelectionProvider');
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- src/state/GraphSelectionContext.test.js`
Expected: PASS.

- [ ] **Step 5: Wire the provider into AppShell**

In `frontend/src/components/layout/AppShell.jsx`, add the import near the other state imports (line ~18):

```jsx
import { GraphSelectionProvider } from '../../state/GraphSelectionContext.jsx';
```

Wrap it inside `ChatSessionProvider` (so both sidebar modes share it):

```jsx
  return (
    <ViewModeProvider>
      <ChatSessionProvider>
        <GraphSelectionProvider>
          <div className="app-shell">
            <BrandBar />
            <AppBody>{children}</AppBody>
          </div>
        </GraphSelectionProvider>
      </ChatSessionProvider>
    </ViewModeProvider>
  );
```

- [ ] **Step 6: Verify lint + commit**

Run: `cd frontend && npm run lint`
Expected: no errors in the two changed files.

```bash
git add frontend/src/state/GraphSelectionContext.jsx frontend/src/state/GraphSelectionContext.test.js frontend/src/components/layout/AppShell.jsx
git commit -s -m "feat(inflow): add GraphSelectionContext to bridge sidebar and canvas"
```

---

### Task 2: Canvas consumes shared selection; remove redundant "+ Add source"

**Files:**
- Modify: `frontend/src/components/editor/graph/InterfaceGraphEditor.jsx`

**Interfaces:**
- Consumes: `useGraphSelection()` from Task 1.
- Produces: the canvas drawer now opens whenever `selectedNodeId` (shared) matches a node — including selections set by the sidebar in Task 3.

- [ ] **Step 1: Replace local selection state with the shared context**

Add the import near the other state imports (top of file):

```jsx
import { useGraphSelection } from '../../../state/GraphSelectionContext.jsx';
```

Remove the local selection state line:

```jsx
const [selectedNodeId, setSelectedNodeId] = useState(null);   // DELETE
```

and replace with:

```jsx
const { selectedNodeId, setSelectedNodeId } = useGraphSelection();
```

(Leave every other `selectedNodeId` / `setSelectedNodeId` usage as-is — the names match.)

- [ ] **Step 2: Remove the "+ Add source" button and its modal**

In the JSX toolbar (`grapheditor__toolbar`), delete the button:

```jsx
<button className="btn btn--accent btn--xs" onClick={() => setAddingSource(true)}>
  <Database size={13} /> Add source
</button>
```

Delete the `addingSource` state and the `<SourceLoader>` modal block at the bottom (`{addingSource && ( ... )}`), plus the now-unused `addingSource`/`setAddingSource` declarations.

Keep `addSource` and the `SourceLoader` import ONLY if the Sources drawer still references them; otherwise remove the `SourceLoader` import and the `addSource` callback too. (Check: after deletion, run lint — it flags unused vars.)

- [ ] **Step 3: Clear selection on unmount so a stale id doesn't reopen a drawer in another view**

In the existing mount/cleanup area, ensure leaving graph mode resets selection. Add this effect near the other `useEffect`s:

```jsx
useEffect(() => () => setSelectedNodeId(null), [setSelectedNodeId]);
```

- [ ] **Step 4: Run lint**

Run: `cd frontend && npm run lint`
Expected: no unused-variable errors (`addingSource`, `SourceLoader`, `Database` if no longer used — remove dead imports until clean).

- [ ] **Step 5: Manual check**

Run: `cd frontend && npm run dev`, open a config in inFlow view. Confirm: clicking a node still opens its drawer; the "+ Add source" button is gone; no console errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/editor/graph/InterfaceGraphEditor.jsx
git commit -s -m "refactor(inflow): canvas uses shared selection; drop redundant Add source button"
```

---

### Task 3: Sidebar palette becomes fully actionable

**Files:**
- Modify: `frontend/src/components/layout/NavRail.jsx`
- Test: `frontend/src/components/layout/navPalette.test.js`

**Interfaces:**
- Consumes: `useGraphSelection()` (Task 1); `useConfig()` (`model`, `updateModel`, `updateInterface`); `upsertSource` (`models/configModel.js`); `listAdd`, `setField` (`models/interfaceOps.js`); `OUTPUT_TYPE_OPTIONS` + `OUTPUT_SCHEMAS` (`forms/schemas/outputSchemas.js`); `setColumns` (`lib/columnStore.js`).
- Produces: exported pure helper `buildPalette()` returning the category/leaf config, so it is unit-testable without the DOM.

- [ ] **Step 1: Write the failing test (palette matches the schemas)**

```js
// frontend/src/components/layout/navPalette.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { buildPalette } from './NavRail.jsx';
import { PRE_PROCESSOR_ORDER } from '../../forms/schemas/preProcessorSchemas.js';
import { OUTPUT_TYPE_OPTIONS } from '../../forms/schemas/outputSchemas.js';

test('palette enumerates exactly the schema-supported types', () => {
  const groups = Object.fromEntries(buildPalette().map((g) => [g.group, g]));

  assert.deepEqual(
    groups.Sources.nodes.map((n) => n.subtype),
    ['file', 'mysql', 'api', 'json', 'rawdatastore'],
  );
  assert.deepEqual(groups.Transforms.nodes.map((n) => n.subtype), PRE_PROCESSOR_ORDER);
  assert.deepEqual(groups.Output.nodes.map((n) => n.subtype), OUTPUT_TYPE_OPTIONS);
  assert.deepEqual(groups.Columns.nodes.map((n) => n.action), ['add_column']);
  assert.deepEqual(groups.Validations.nodes.map((n) => n.action), ['add_validation']);

  // Every leaf is actionable — no dead info-only chips.
  for (const g of buildPalette()) {
    for (const n of g.nodes) assert.ok(n.subtype || n.action, `stale leaf in ${g.group}: ${n.label}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- src/components/layout/navPalette.test.js`
Expected: FAIL — `buildPalette` is not exported.

- [ ] **Step 3: Replace the static `NODE_PALETTE` with an exported `buildPalette()`**

In `NavRail.jsx`, add these imports:

```jsx
import { upsertSource } from '../../models/configModel.js';
import { listAdd, setField } from '../../models/interfaceOps.js';
import { OUTPUT_SCHEMAS, OUTPUT_TYPE_OPTIONS } from '../../forms/schemas/outputSchemas.js';
import { setColumns } from '../../lib/columnStore.js';
import { useGraphSelection } from '../../state/GraphSelectionContext.jsx';
```

Add source icons to the existing `TRANSFORM_ICONS` neighbourhood:

```jsx
const SOURCE_LEAVES = [
  { subtype: 'file',         label: 'File',         icon: <FileOutput size={15} />, color: '#3b82f6' },
  { subtype: 'mysql',        label: 'Database (MySQL)', icon: <Database size={15} />, color: '#3b82f6' },
  { subtype: 'api',          label: 'API',          icon: <Plus size={15} />,       color: '#3b82f6' },
  { subtype: 'json',         label: 'JSON payload', icon: <Columns size={15} />,    color: '#3b82f6' },
  { subtype: 'rawdatastore', label: 'Raw frame',    icon: <Layers size={15} />,     color: '#3b82f6' },
];
```

Replace the `const NODE_PALETTE = [...]` array with an exported builder:

```jsx
// Every leaf is actionable: `subtype` items add a node of that type; `action` items run a named
// handler (columns/validations are singletons — they append a row / open the existing drawer).
export function buildPalette() {
  return [
    {
      group: 'Sources',
      note: 'A pipeline can read many sources; the first is the base input, the rest feed transforms.',
      nodes: SOURCE_LEAVES,
    },
    {
      group: 'Transforms',
      note: 'Merge, union, filter and reshape steps run in order on the base input.',
      nodes: PRE_PROCESSOR_ORDER.map((key) => {
        const s = PRE_PROCESSOR_SCHEMAS[key];
        return {
          subtype: key,
          label: s.label,
          icon: TRANSFORM_ICONS[key] || <Filter size={15} />,
          color: '#f59e0b',
          description: s.description,
          hint: s.hint,
          writes: (s.yamlFields || []).join(', '),
          draggable: true, // transforms also support drag-to-canvas
        };
      }),
    },
    {
      group: 'Columns',
      note: 'Columns map source fields to output fields. Add one, then edit the mapping in the drawer.',
      nodes: [{ action: 'add_column', label: 'Add column', icon: <Columns size={15} />, color: '#7853EC' }],
    },
    {
      group: 'Validations',
      note: 'Optional great_expectations checks, attached per column. Opens the validations editor.',
      nodes: [{ action: 'add_validation', label: 'Add validation', icon: <ShieldCheck size={15} />, color: '#10b981' }],
    },
    {
      group: 'Output',
      note: 'One destination per interface. Use Splitted file or JSON writer for multi-shape output.',
      nodes: OUTPUT_TYPE_OPTIONS.map((key) => ({
        subtype: key,
        label: OUTPUT_SCHEMAS[key].label,
        icon: <FileOutput size={15} />,
        color: '#ef4444',
      })),
    },
  ];
}
```

- [ ] **Step 4: Run the palette test to verify it passes**

Run: `cd frontend && npm run test -- src/components/layout/navPalette.test.js`
Expected: PASS.

- [ ] **Step 5: Wire the click handlers in `GraphPalette`**

Inside `GraphPalette`, pull the extra context/model helpers:

```jsx
const { model, updateModel, updateInterface } = useConfig();
const { setSelectedNodeId } = useGraphSelection();
```

Add the per-category add helpers (defaults mirror `models/applyIntent.js`):

```jsx
// Auto-id a new source: source_1, source_2, … avoiding collisions.
function nextSourceId(model) {
  const taken = new Set(model.sourceOrder ?? []);
  let n = 1;
  while (taken.has(`source_${n}`)) n += 1;
  return `source_${n}`;
}

const SOURCE_DEFAULTS = {
  file: (id) => ({ id, type: 'file', file_type: 'delimited_file', file_path: `data/${id}.csv` }),
  mysql: (id) => ({ id, type: 'mysql', database: '', query: 'SELECT * FROM table' }),
  api: (id) => ({ id, type: 'api', url: '', method: 'GET' }),
  json: (id) => ({ id, type: 'json' }),
  rawdatastore: (id) => ({ id, type: 'rawdatastore' }),
};

const addSourceNode = (type) => {
  if (!interfaceName) return;
  const id = nextSourceId(model);
  updateModel((m) => upsertSource(m, SOURCE_DEFAULTS[type](id)));
  updateInterface(interfaceName, (it) => {
    const cur = it.sources ?? [];
    return cur.includes(id) ? it : { ...it, sources: [...cur, id] };
  });
  setColumns(id, []);
  setSelectedNodeId(`src-${id}`);
};

const addOutputNode = (type) => {
  if (!interfaceName) return;
  updateInterface(interfaceName, (it) => setField(it, 'output', { type, props: it.output?.props ?? {} }));
  setSelectedNodeId('output-node');
};

const addColumnNode = () => {
  if (!interfaceName) return;
  updateInterface(interfaceName, (it) => listAdd(it, 'columns', { src_col_name: '', dest_col_name: '' }));
  setSelectedNodeId('columns-node');
};

const openValidations = () => {
  if (!interfaceName) return;
  setSelectedNodeId('validation-node'); // existing drawer handles column + expectation + severity
};

// Existing transform adder, now also selects the new node so its drawer opens.
const addTransform = (subtype) => {
  if (!interfaceName || !subtype) return;
  const newIdx = (model.interfacesByName?.[interfaceName]?.pre_processing?.length) ?? 0;
  updateInterface(interfaceName, (i) => ({ ...i, pre_processing: [...(i.pre_processing ?? []), { type: subtype }] }));
  setSelectedNodeId(`pre-${newIdx}`);
};
```

Add a single dispatcher used by every leaf's click/keydown:

```jsx
const runLeaf = (group, node) => {
  if (group === 'Sources') return addSourceNode(node.subtype);
  if (group === 'Transforms') return addTransform(node.subtype);
  if (group === 'Output') return addOutputNode(node.subtype);
  if (node.action === 'add_column') return addColumnNode();
  if (node.action === 'add_validation') return openValidations();
};
```

- [ ] **Step 6: Render leaves from `buildPalette()` (all actionable)**

Replace the `NODE_PALETTE.map(...)` render with `buildPalette().map(...)`. Every leaf is now a button; drag stays only where `node.draggable` is set:

```jsx
{buildPalette().map((group) => {
  const nodes = group.nodes.filter(matches);
  if (nodes.length === 0) return null;
  const isCollapsed = !q && collapsed[group.group];
  return (
    <div key={group.group} className="palette__group">
      <button
        className="palette__group-head"
        onClick={() => setCollapsed((c) => ({ ...c, [group.group]: !c[group.group] }))}
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        <span>{group.group}</span>
        <span className="palette__group-count">{nodes.length}</span>
      </button>

      {!isCollapsed && (
        <div className="palette__nodes">
          {nodes.map((node) => (
            <div
              key={node.label}
              className="palette-node palette-node--addable"
              style={{ '--node-color': node.color }}
              draggable={Boolean(node.draggable)}
              onDragStart={node.draggable ? (e) => onDragStart(e, { type: 'transformNode', subtype: node.subtype }) : undefined}
              role="button"
              tabIndex={0}
              onClick={() => runLeaf(group.group, node)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); runLeaf(group.group, node); } }}
              onMouseEnter={(e) => showTip(e, node, group.note)}
              onFocus={(e) => showTip(e, node, group.note)}
              onMouseLeave={hideTip}
              onBlur={hideTip}
            >
              <span className="palette-node__icon" style={{ color: node.color }}>{node.icon}</span>
              <span className="palette-node__text">
                <span className="palette-node__label">{node.label}</span>
                {node.writes && <span className="palette-node__sub">{node.writes}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
})}
```

Note `matches` references `node.description`; sources/output leaves have none — guard already handles `(n.description || '')`. Keep the existing search box and `palette-tip` block unchanged.

- [ ] **Step 7: Run the full frontend test suite + lint**

Run: `cd frontend && npm run test && npm run lint`
Expected: all tests pass; no unused imports (remove any leftover `ListFilter`/`Table2`/etc. only if now unused).

- [ ] **Step 8: Manual check (the acceptance criteria)**

Run: `cd frontend && npm run dev`. In inFlow view:
1. Expand **Sources** → click **Database (MySQL)** → a source node appears and the Sources drawer opens.
2. Expand **Columns** → click **Add column** → a blank column row is added and the Columns drawer opens.
3. Expand **Output** → click **Excel** → output node updates and the Output drawer opens.
4. Expand **Validations** → click **Add validation** → the validations drawer opens.
5. The search box filters leaves across all groups.
6. Transforms still add by click AND drag.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/layout/NavRail.jsx frontend/src/components/layout/navPalette.test.js
git commit -s -m "feat(inflow): make every sidebar category an actionable add-menu"
```

---

### Task 4: Config-drawer polish (frontend-design)

**Files:**
- Modify: `frontend/src/components/editor/graph/InterfaceGraphEditor.jsx` (drawer header only), `frontend/src/index.css` (drawer/palette styles).

**Interfaces:**
- Consumes: the drawers wired in Tasks 2–3. No logic change — presentation only.

REQUIRED SUB-SKILL at execution: `frontend-design:frontend-design`.

- [ ] **Step 1: Add a one-line purpose under each drawer title**

In `InterfaceGraphEditor`'s `drawerContent`, give each entry a `subtitle` and render it under `drawer-title` (e.g. Sources → "Where the pipeline reads data from", Columns → "Map source fields to output fields", Output → "Where the generated interface is written"). Render:

```jsx
<div className="grapheditor__drawer-head">
  <div>
    <span className="grapheditor__drawer-title">{drawerContent.title}</span>
    {drawerContent.subtitle && <span className="grapheditor__drawer-sub">{drawerContent.subtitle}</span>}
  </div>
  <button className="grapheditor__drawer-close" onClick={() => setSelectedNodeId(null)}><X size={16} /></button>
</div>
```

- [ ] **Step 2: Style the new elements**

In `index.css`, add `.grapheditor__drawer-sub` (muted, 12px, block) and ensure `.palette-node--addable` has a clear hover/focus affordance and consistent left-color accent via `--node-color`. Apply frontend-design judgement on spacing/typography; keep within existing token variables.

- [ ] **Step 3: Manual visual check + commit**

Run: `cd frontend && npm run dev` — confirm each drawer reads cleanly (title + purpose), leaves have obvious hover/focus, helper text sits under its field.

```bash
git add frontend/src/components/editor/graph/InterfaceGraphEditor.jsx frontend/src/index.css
git commit -s -m "style(inflow): drawer subtitles and actionable-leaf affordances"
```

---

## Self-Review

**Spec coverage:**
- Sources 5 leaves + remove canvas button → Tasks 2, 3. ✓
- Transforms unchanged (click + drag + dropdown + search) → Task 3 (`draggable`, search box retained). ✓
- Columns "Add column" + note → Task 3. ✓
- Validations single non-stale leaf → opens existing drawer → Task 3. ✓
- Output 6 writer leaves → Task 3. ✓
- `GraphSelectionContext` plumbing → Task 1. ✓
- Drawer polish (frontend-design) → Task 4. ✓
- Palette-matches-schema test → Task 3 Step 1. ✓

**Placeholder scan:** No TBD/TODO; all code blocks concrete.

**Type consistency:** `setSelectedNodeId` used identically in Tasks 1–3; node-id strings (`src-<id>`, `pre-<idx>`, `columns-node`, `output-node`, `validation-node`) match `InterfaceGraphEditor`'s existing conventions; `buildPalette()` leaf shape (`subtype` | `action`) consistent between Task 3 Step 1 test and Step 3 implementation.
