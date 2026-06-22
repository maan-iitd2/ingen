import { useEffect, useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Database,
  Filter,
  Columns,
  ArrowRightLeft,
  ShieldCheck,
  FileOutput,
  X,
  Trash2,
  Plug,
} from 'lucide-react';

import { useConfig } from '../../../state/ConfigContext.jsx';
import { useGraphSelection } from '../../../state/GraphSelectionContext.jsx';
import SchemaForm from '../../../forms/SchemaForm.jsx';
import { preProcessorSchema, PRE_PROCESSOR_SCHEMAS } from '../../../forms/schemas/preProcessorSchemas.js';

import SourcesTab from '../tabs/SourcesTab.jsx';
import ColumnsTab from '../tabs/ColumnsTab.jsx';
import PostProcessingTab from '../tabs/PostProcessingTab.jsx';
import ValidationsTab from '../tabs/ValidationsTab.jsx';
import OutputTab from '../tabs/OutputTab.jsx';

// ── Stage palette + the source-patching contract ────────────────────────────

const STAGE = {
  source: '#3b82f6',
  transform: '#f59e0b',
  columns: '#7853EC',
  post: '#ec4899',
  validation: '#10b981',
  output: '#ef4444',
};

// Pre-processors that pull in a SECONDARY source. Wiring a source node into one of these writes the
// named YAML field; `multi` types accept a list (union/melt), the rest a single id. `tag` labels the
// dashed feed edge so the relationship is legible on the canvas. Mirrors preProcessorSchemas.js,
// which mirrors the committed backend (ingen/pre_processor/*).
const SOURCE_CONSUMERS = {
  merge: { param: 'source', multi: false, tag: 'right' },
  outer_join: { param: 'source', multi: false, tag: 'right' },
  mask: { param: 'masking_source', multi: false, tag: 'mask' },
  not_equals_filter: { param: 'source', multi: false, tag: 'exclude' },
  union: { param: 'source', multi: true, tag: '∪' },
  melt: { param: 'source', multi: true, tag: 'melt' },
};

/** Read a consumer's wired source ids as an array (handles single vs list params + stray scalars). */
function wiredSources(step) {
  const spec = SOURCE_CONSUMERS[step?.type];
  if (!spec) return [];
  const v = step[spec.param];
  if (v == null || v === '') return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
}

// ── Utilities ──────────────────────────────────────────────────────────────

const tr = (s, n = 28) => (s && s.length > n ? s.slice(0, n) + '…' : s);
const SRC = 'src-';
const PRE = 'pre-';

// ── Mini property table shown in each node body ────────────────────────────

const PropTable = ({ rows }) => {
  const visible = rows.filter((r) => r.value != null && r.value !== '');
  if (!visible.length) return null;
  return (
    <div className="custom-node__props">
      {visible.map(({ key, value }) => (
        <div key={key} className="custom-node__prop-row">
          <span className="custom-node__prop-key">{key}</span>
          <span className="custom-node__prop-val">{String(value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Node header (shared) ───────────────────────────────────────────────────

const CustomNodeHeader = ({ icon, title, type, color }) => (
  <div className="custom-node__header">
    <div className="custom-node__icon-box" style={{ backgroundColor: `${color}18`, color }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div className="custom-node__title">{title}</div>
      <div className="custom-node__type">{type}</div>
    </div>
  </div>
);

// ── Custom Node Types ──────────────────────────────────────────────────────

const SourceNode = ({ data }) => {
  const d = data.details || {};
  const rows = [{ key: 'type', value: d.type }];
  if (d.file_type) rows.push({ key: 'format', value: d.file_type });
  if (d.file_path) rows.push({ key: 'path', value: tr(d.file_path) });
  if (d.database || d.db_token) rows.push({ key: 'db', value: d.database || d.db_token });
  if (d.url) rows.push({ key: 'url', value: tr(d.url) });
  if (d.type === 'rawdatastore') rows.push({ key: 'frame', value: 'in-memory' });

  const cls =
    'custom-node' +
    (data.selected ? ' custom-node--selected' : '') +
    (data.unused ? ' custom-node--unused' : '');

  return (
    <div className={cls} style={{ borderLeft: `4px solid ${STAGE.source}` }}>
      <CustomNodeHeader
        icon={<Database size={14} />}
        title={data.label}
        type={data.role === 'base' ? 'Base input' : 'Source'}
        color={STAGE.source}
      />
      <div className="custom-node__body">
        <PropTable rows={rows} />
        {data.unused && (
          <span className="custom-node__warn">Not wired — drag its port into a transform</span>
        )}
      </div>
      {/* Output port: feeds the chain (base) or patches into a transform's source-in port. */}
      <Handle type="source" position={Position.Right} className="rf-handle rf-handle--out" />
    </div>
  );
};

const PreprocessNode = ({ data }) => {
  const s = data.details || {};
  const spec = SOURCE_CONSUMERS[s.type];
  const wired = wiredSources(s);
  const rows = [{ key: 'type', value: s.type }];
  if (s.type === 'merge' || s.type === 'outer_join') {
    if (s.merge_type) rows.push({ key: 'join', value: s.merge_type });
    if (s.left_key && s.right_key) rows.push({ key: 'on', value: `${s.left_key} = ${s.right_key}` });
  }
  if (s.type === 'not_equals_filter') {
    const cols = s.cols || [];
    if (cols.length) rows.push({ key: 'filter', value: `${cols[0].col} ≠ ${(cols[0].val || []).join(',')}${cols.length > 1 ? ` +${cols.length - 1}` : ''}` });
  }
  if (s.type === 'aggregate') {
    rows.push({ key: 'group', value: (s.group_by || []).join(', ') || '—' });
  }

  return (
    <div className={`custom-node${data.selected ? ' custom-node--selected' : ''}`} style={{ borderLeft: `4px solid ${STAGE.transform}` }}>
      <Handle type="target" position={Position.Left} id="in" className="rf-handle rf-handle--in" />
      <CustomNodeHeader
        icon={<Filter size={14} />}
        title={`${data.index + 1}. ${data.label}`}
        type="Transform"
        color={STAGE.transform}
      />

      {/* Secondary source-in port — only on transforms that reference another source. */}
      {spec && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            id="src-in"
            className="rf-handle rf-handle--feed"
            title="Patch a source here"
          />
          <span className="custom-node__feedport" aria-hidden="true">
            <Plug size={9} /> source
          </span>
        </>
      )}

      <div className="custom-node__body">
        <PropTable rows={rows} />
        {spec && (
          <div className="custom-node__feeds">
            {wired.length ? (
              wired.map((sid) => (
                <span key={sid} className="custom-node__feedchip">{sid}</span>
              ))
            ) : (
              <span className="custom-node__feedhint">needs a {spec.tag} source</span>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="out" className="rf-handle rf-handle--out" />
    </div>
  );
};

const ColumnsNode = ({ data }) => {
  const shown = (data.columnNames || []).slice(0, 5);
  const more = (data.count || 0) - shown.length;

  return (
    <div className={`custom-node${data.selected ? ' custom-node--selected' : ''}`} style={{ borderLeft: `4px solid ${STAGE.columns}` }}>
      <Handle type="target" position={Position.Left} id="in" className="rf-handle rf-handle--in" />
      <CustomNodeHeader
        icon={<Columns size={14} />}
        title="Columns"
        type={`${data.count} mapped`}
        color={STAGE.columns}
      />
      <div className="custom-node__body">
        <div className="custom-node__collist">
          {shown.map((name) => (
            <span key={name} className="custom-node__colchip">{name}</span>
          ))}
          {more > 0 && <span className="custom-node__colmore">+{more} more</span>}
          {data.count === 0 && <span className="custom-node__info">No columns defined</span>}
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="out" className="rf-handle rf-handle--out" />
    </div>
  );
};

const PostprocessNode = ({ data }) => {
  // post_processing is a list of steps; show the first (only pivot is supported today).
  const step = (data.steps || [])[0] || {};
  const pv = step.processing_values || {};
  const rows = [
    { key: 'type', value: step.type || null },
    { key: 'pivot', value: pv.pivot_col || null },
    { key: 'value', value: pv.value_col || null },
  ];

  return (
    <div className={`custom-node${data.selected ? ' custom-node--selected' : ''}`} style={{ borderLeft: `4px solid ${STAGE.post}` }}>
      <Handle type="target" position={Position.Left} id="in" className="rf-handle rf-handle--in" />
      <CustomNodeHeader icon={<ArrowRightLeft size={14} />} title="Post-processing" type="Reshape" color={STAGE.post} />
      <div className="custom-node__body">
        <PropTable rows={rows} />
      </div>
      <Handle type="source" position={Position.Right} id="out" className="rf-handle rf-handle--out" />
    </div>
  );
};

const ValidationsNode = ({ data }) => (
  <div className={`custom-node${data.selected ? ' custom-node--selected' : ''}`} style={{ borderLeft: `4px solid ${STAGE.validation}` }}>
    <Handle type="target" position={Position.Left} id="in" className="rf-handle rf-handle--in" />
    <CustomNodeHeader icon={<ShieldCheck size={14} />} title="Validations" type="GE expectations" color={STAGE.validation} />
    <div className="custom-node__body">
      <PropTable rows={[{ key: 'count', value: data.count || 0 }]} />
    </div>
    <Handle type="source" position={Position.Right} id="out" className="rf-handle rf-handle--out" />
  </div>
);

const OutputNode = ({ data }) => {
  const d = data.details || {};
  const rows = [
    { key: 'type', value: d.type },
    { key: 'path', value: d.props?.path ? tr(d.props.path) : null },
    { key: 'store', value: d.props?.id || null },
    { key: 'sheet', value: d.props?.sheet_name || null },
  ];

  return (
    <div className={`custom-node${data.selected ? ' custom-node--selected' : ''}`} style={{ borderLeft: `4px solid ${STAGE.output}` }}>
      <Handle type="target" position={Position.Left} id="in" className="rf-handle rf-handle--in" />
      <CustomNodeHeader icon={<FileOutput size={14} />} title="Output" type="Writer" color={STAGE.output} />
      <div className="custom-node__body">
        <PropTable rows={rows} />
      </div>
    </div>
  );
};

const nodeTypes = {
  source: SourceNode,
  preprocess: PreprocessNode,
  columns: ColumnsNode,
  postprocess: PostprocessNode,
  validations: ValidationsNode,
  output: OutputNode,
};

// ── Main Graph Component ───────────────────────────────────────────────────

export default function InterfaceGraphEditor({ interfaceName, iface }) {
  const { model, updateInterface } = useConfig();
  const { selectedNodeId, setSelectedNodeId } = useGraphSelection();

  // Leaving graph mode clears the shared selection so a stale id doesn't reopen a drawer elsewhere.
  useEffect(() => () => setSelectedNodeId(null), [setSelectedNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const apply = useCallback((fn) => updateInterface(interfaceName, fn), [updateInterface, interfaceName]);

  // Build graph topology when the data model changes.
  // selectedNodeId is intentionally NOT in this dep array — selection updates
  // positions via a separate effect so user-dragged positions are preserved.
  useEffect(() => {
    const newNodes = [];
    const newEdges = [];

    const sources = iface.sources ?? [];
    const preProcesses = iface.pre_processing ?? [];
    const columns = iface.columns ?? [];
    const postProcess = iface.post_processing ?? [];
    // Validations live per-column (columns[i].validations[]), not on the interface.
    const validationCount = columns.reduce((n, c) => n + (c.validations?.length ?? 0), 0);
    const output = iface.output ?? {};

    // Backend semantics: source[0] is the pipeline's base input; any other listed source only
    // belongs in the graph if a transform references it (merge/mask/union/…). Sources that are
    // neither are "unused" — surfaced as a real authoring smell rather than silently chained.
    const baseSid = sources[0];
    const referenced = new Set();
    preProcesses.forEach((step) => wiredSources(step).forEach((sid) => referenced.add(sid)));

    let colIndex = 0;
    const colWidth = 270;

    sources.forEach((sid, idx) => {
      newNodes.push({
        id: `${SRC}${sid}`,
        type: 'source',
        position: { x: colIndex * colWidth + 40, y: 60 + idx * 150 },
        data: {
          label: sid,
          details: model.sourcesById?.[sid],
          role: sid === baseSid ? 'base' : 'secondary',
          unused: sid !== baseSid && !referenced.has(sid),
          selected: false,
        },
      });
    });
    if (sources.length > 0) colIndex++;

    preProcesses.forEach((step, idx) => {
      newNodes.push({
        id: `pre-${idx}`,
        type: 'preprocess',
        position: { x: colIndex * colWidth + 40, y: 60 + idx * 155 },
        data: {
          label: PRE_PROCESSOR_SCHEMAS[step.type]?.label || step.type,
          index: idx,
          details: step,
          selected: false,
        },
      });
    });
    if (preProcesses.length > 0) colIndex++;

    const columnsNodeId = 'columns-node';
    newNodes.push({
      id: columnsNodeId,
      type: 'columns',
      position: { x: colIndex * colWidth + 40, y: 140 },
      data: {
        label: 'Columns Mapping',
        count: columns.length,
        columnNames: columns.map((c) => c.dest_col_name || c.src_col_name).filter(Boolean),
        selected: false,
      },
    });
    colIndex++;

    const postNodeId = 'post-node';
    const hasPost = postProcess.length > 0;
    if (hasPost) {
      newNodes.push({
        id: postNodeId,
        type: 'postprocess',
        position: { x: colIndex * colWidth + 40, y: 140 },
        data: { label: 'Post-processing', steps: postProcess, selected: false },
      });
      colIndex++;
    }

    const validationNodeId = 'validation-node';
    newNodes.push({
      id: validationNodeId,
      type: 'validations',
      position: { x: colIndex * colWidth + 40, y: 140 },
      data: { label: 'GE Validations', count: validationCount, selected: false },
    });
    colIndex++;

    const outputNodeId = 'output-node';
    newNodes.push({
      id: outputNodeId,
      type: 'output',
      position: { x: colIndex * colWidth + 40, y: 140 },
      data: { label: 'Output Destination', details: output, selected: false },
    });

    // ── Main flow: solid purple, left→right. Only the BASE source feeds the chain start. ──
    const flowStyle = { stroke: STAGE.columns, strokeWidth: 2 };
    const flow = (id, source, target) => ({
      id, source, target, sourceHandle: 'out', targetHandle: 'in',
      animated: true, style: flowStyle,
      markerEnd: { type: MarkerType.ArrowClosed, color: STAGE.columns, width: 16, height: 16 },
    });

    const chainStart = preProcesses.length > 0 ? `${PRE}0` : columnsNodeId;
    if (baseSid) newEdges.push(flow(`flow-base-${chainStart}`, `${SRC}${baseSid}`, chainStart));

    preProcesses.forEach((_, idx) => {
      const next = idx < preProcesses.length - 1 ? `${PRE}${idx + 1}` : columnsNodeId;
      newEdges.push(flow(`flow-pre${idx}`, `${PRE}${idx}`, next));
    });

    let tail = columnsNodeId;
    if (hasPost) {
      newEdges.push(flow('flow-cols-post', columnsNodeId, postNodeId));
      tail = postNodeId;
    }
    newEdges.push(flow('flow-tail-val', tail, validationNodeId));
    newEdges.push(flow('flow-val-out', validationNodeId, outputNodeId));

    // ── Feed edges: dashed, source-colored, labeled. One per (consumer, wired source). These ARE
    // the YAML — they render whatever `source`/`masking_source` each transform declares. ──
    preProcesses.forEach((step, idx) => {
      const spec = SOURCE_CONSUMERS[step.type];
      if (!spec) return;
      wiredSources(step).forEach((sid) => {
        if (!model.sourcesById?.[sid] && !(iface.sources ?? []).includes(sid)) return;
        newEdges.push({
          id: `feed-${sid}-pre${idx}`,
          source: `${SRC}${sid}`,
          target: `${PRE}${idx}`,
          sourceHandle: 'out',
          targetHandle: 'src-in',
          data: { feed: true, sid, preIdx: idx },
          label: spec.tag,
          labelStyle: { fill: STAGE.source, fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600 },
          labelBgStyle: { fill: '#fff', stroke: STAGE.source, strokeWidth: 1 },
          labelBgPadding: [5, 3],
          labelBgBorderRadius: 5,
          style: { stroke: STAGE.source, strokeWidth: 1.6, strokeDasharray: '5 4' },
          markerEnd: { type: MarkerType.Arrow, color: STAGE.source },
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [iface, model, setNodes, setEdges]);

  // Apply selection highlight without rebuilding positions (keeps user-dragged layouts intact)
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, selected: n.id === selectedNodeId } }))
    );
  }, [selectedNodeId, setNodes]);

  // A connection is only meaningful when a SOURCE is patched into a transform's source-in port.
  const connectionSpec = useCallback(
    (conn) => {
      if (!conn.source?.startsWith(SRC) || !conn.target?.startsWith(PRE)) return null;
      if (conn.targetHandle && conn.targetHandle !== 'src-in') return null;
      const idx = parseInt(conn.target.slice(PRE.length), 10);
      const step = iface.pre_processing?.[idx];
      const spec = step && SOURCE_CONSUMERS[step.type];
      if (!spec) return null;
      return { idx, sid: conn.source.slice(SRC.length), spec };
    },
    [iface],
  );

  const isValidConnection = useCallback((conn) => Boolean(connectionSpec(conn)), [connectionSpec]);

  // Drawing a connection WRITES the transform's source field — the YAML updates, then the effect
  // re-derives the feed edge from the model. Single-source params replace; list params append.
  const onConnect = useCallback(
    (conn) => {
      const hit = connectionSpec(conn);
      if (!hit) return;
      const { idx, sid, spec } = hit;
      apply((it) => {
        const list = [...(it.pre_processing ?? [])];
        const cur = { ...list[idx] };
        if (spec.multi) {
          const arr = Array.isArray(cur[spec.param]) ? cur[spec.param] : cur[spec.param] ? [cur[spec.param]] : [];
          if (!arr.includes(sid)) cur[spec.param] = [...arr, sid];
        } else {
          cur[spec.param] = sid;
        }
        list[idx] = cur;
        return { ...it, pre_processing: list };
      });
    },
    [apply, connectionSpec],
  );

  // Deleting a feed edge clears that source from the transform's field (symmetry with onConnect).
  const onEdgesDelete = useCallback(
    (deleted) => {
      deleted.forEach((e) => {
        if (!e.data?.feed) return;
        const { preIdx: idx, sid } = e.data;
        apply((it) => {
          const list = [...(it.pre_processing ?? [])];
          const step = list[idx];
          const spec = step && SOURCE_CONSUMERS[step.type];
          if (!spec) return it;
          const cur = { ...step };
          if (spec.multi) {
            // Coerce a stray scalar (e.g. from an imported config) to an array first, so deleting
            // one feed edge removes only that source instead of wiping the whole field.
            const raw = cur[spec.param];
            const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
            cur[spec.param] = arr.filter((s) => s !== sid);
          } else if (cur[spec.param] === sid) {
            delete cur[spec.param];
          }
          list[idx] = cur;
          return { ...it, pre_processing: list };
        });
      });
    },
    [apply],
  );

  const onNodeClick = useCallback((_event, node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  }, [setSelectedNodeId]);

  // Drag-from-palette: only Transform nodes are droppable
  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/reactflow');
      if (!raw) return;
      const nodeData = JSON.parse(raw);
      if (nodeData.type === 'transformNode' && nodeData.subtype) {
        // New step lands at the end; select it AFTER applying (keep the state updater pure — no
        // side effects inside it, which React may invoke more than once).
        const newIdx = iface.pre_processing?.length ?? 0;
        apply((i) => ({ ...i, pre_processing: [...(i.pre_processing ?? []), { type: nodeData.subtype }] }));
        setTimeout(() => setSelectedNodeId(`pre-${newIdx}`), 50);
      }
    },
    [apply, iface, setSelectedNodeId]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const drawerContent = useMemo(() => {
    if (!selectedNodeId) return null;

    if (selectedNodeId === 'columns-node') {
      return { title: 'Columns mapping', Component: <ColumnsTab interfaceName={interfaceName} iface={iface} /> };
    }
    if (selectedNodeId === 'post-node') {
      return { title: 'Post-processing (pivot)', Component: <PostProcessingTab interfaceName={interfaceName} iface={iface} /> };
    }
    if (selectedNodeId === 'validation-node') {
      return { title: 'Validation expectations', Component: <ValidationsTab interfaceName={interfaceName} iface={iface} /> };
    }
    if (selectedNodeId === 'output-node') {
      return { title: 'Output destination', Component: <OutputTab interfaceName={interfaceName} iface={iface} /> };
    }
    if (selectedNodeId.startsWith('src-')) {
      return { title: 'Interface sources', Component: <SourcesTab interfaceName={interfaceName} iface={iface} /> };
    }
    if (selectedNodeId.startsWith('pre-')) {
      const idx = parseInt(selectedNodeId.split('-')[1], 10);
      const step = iface.pre_processing?.[idx];
      if (!step) return null;
      return {
        title: `Transform: ${PRE_PROCESSOR_SCHEMAS[step.type]?.label || step.type}`,
        Component: (
          <div className="tabcontent">
            <SchemaForm
              schema={preProcessorSchema(step.type)}
              value={step}
              ctx={{ sources: model.sourceOrder }}
              onChange={(next) =>
                apply((it) => {
                  const updated = [...(it.pre_processing ?? [])];
                  updated[idx] = { ...next, type: step.type };
                  return { ...it, pre_processing: updated };
                })
              }
            />
            <button
              className="btn btn--danger"
              style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
              onClick={() => {
                apply((it) => ({ ...it, pre_processing: (it.pre_processing ?? []).filter((_, i) => i !== idx) }));
                setSelectedNodeId(null);
              }}
            >
              <Trash2 size={14} /> Remove step
            </button>
          </div>
        ),
      };
    }
    return null;
  }, [selectedNodeId, iface, interfaceName, model, apply, setSelectedNodeId]);

  return (
    <div className="grapheditor">
      <div className="grapheditor__canvas" onDrop={onDrop} onDragOver={onDragOver}>
        <div className="grapheditor__toolbar">
          <span className="grapheditor__hint">
            Add nodes from the left palette.{' '}
            Data flows left → right. To combine sources, drag a source’s port onto a transform’s
            <strong> source-in</strong> port — it writes the transform’s <code>source</code> in the
            YAML. Click any node to edit it.
          </span>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          isValidConnection={isValidConnection}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          connectionLineStyle={{ stroke: STAGE.source, strokeWidth: 1.8, strokeDasharray: '5 4' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color={STAGE.columns} variant="dots" opacity={0.06} gap={22} size={1.5} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => STAGE[n.type === 'preprocess' ? 'transform' : n.type === 'postprocess' ? 'post' : n.type === 'validations' ? 'validation' : n.type] || STAGE.output}
            maskColor="rgba(248, 247, 255, 0.7)"
          />
        </ReactFlow>

        <div className="grapheditor__legend">
          <span className="grapheditor__legend-item"><i className="leg leg--flow" /> data flow</span>
          <span className="grapheditor__legend-item"><i className="leg leg--feed" /> source feed → YAML</span>
        </div>
      </div>

      {selectedNodeId && drawerContent && (
        <div className="grapheditor__drawer">
          <div className="grapheditor__drawer-head">
            <span className="grapheditor__drawer-title">{drawerContent.title}</span>
            <button className="grapheditor__drawer-close" onClick={() => setSelectedNodeId(null)}>
              <X size={16} />
            </button>
          </div>
          <div className="grapheditor__drawer-body">{drawerContent.Component}</div>
        </div>
      )}
    </div>
  );
}
