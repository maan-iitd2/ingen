import React, { useState, useCallback } from 'react';
import ReactFlow, { 
  MiniMap, Controls, Background, addEdge, 
  applyNodeChanges, applyEdgeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNodes from '../components/Canvas/CustomNodes';
import PropertiesPanel from '../components/PropertiesPanel/PropertiesPanel';
import DataPreview from '../components/DataPreview/DataPreview';
import ValidationCenter from '../components/ValidationCenter/ValidationCenter';
import './PipelineBuilder.css';
import { Database, Filter, ArrowRightLeft, FileOutput, ShieldCheck, Table, ShieldAlert } from 'lucide-react';

const nodeTypes = {
  sourceNode: CustomNodes.SourceNode,
  transformNode: CustomNodes.TransformNode,
  validationNode: CustomNodes.ValidationNode,
  outputNode: CustomNodes.OutputNode,
};

const initialNodes = [
  { id: '1', type: 'sourceNode', position: { x: 100, y: 150 }, data: { label: 'CSV Source', type: 'File' } },
  { id: '2', type: 'transformNode', position: { x: 350, y: 150 }, data: { label: 'Filter', type: 'Filter' } },
  { id: '3', type: 'validationNode', position: { x: 600, y: 150 }, data: { label: 'Not Null', type: 'Data Quality' } },
  { id: '4', type: 'outputNode', position: { x: 850, y: 150 }, data: { label: 'CSV Output', type: 'File' } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#7853EC' } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#7853EC' } },
  { id: 'e3-4', source: '3', target: '4', animated: true, style: { stroke: '#7853EC' } },
];

export default function PipelineBuilder() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [bottomTab, setBottomTab] = useState('preview');
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#7853EC' } }, eds)), []);

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
  };

  const onDragStart = (event, nodeType, label) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const reactFlowBounds = event.target.getBoundingClientRect();
      const nodeDataStr = event.dataTransfer.getData('application/reactflow');
      if (!nodeDataStr) return;
      
      const nodeData = JSON.parse(nodeDataStr);
      const position = {
        x: event.clientX - reactFlowBounds.left - 75,
        y: event.clientY - reactFlowBounds.top - 25,
      };

      const newNode = {
        id: `node_${new Date().getTime()}`,
        type: nodeData.type,
        position,
        data: { label: nodeData.label, type: nodeData.label },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="builder-layout h-full flex flex-col">
      <div className="builder-container flex-1">
        <div className="builder-sidebar">
          <h3 className="sidebar-title">Nodes</h3>
          
          <div className="node-group">
            <h4 className="group-title">Sources</h4>
            <div className="draggable-node" draggable onDragStart={(e) => onDragStart(e, 'sourceNode', 'Database')}>
              <Database size={16} /> Database
            </div>
            <div className="draggable-node" draggable onDragStart={(e) => onDragStart(e, 'sourceNode', 'CSV File')}>
              <FileOutput size={16} /> CSV File
            </div>
          </div>

          <div className="node-group">
            <h4 className="group-title">Transformations</h4>
            <div className="draggable-node" draggable onDragStart={(e) => onDragStart(e, 'transformNode', 'Filter')}>
              <Filter size={16} /> Filter
            </div>
            <div className="draggable-node" draggable onDragStart={(e) => onDragStart(e, 'transformNode', 'Join')}>
              <ArrowRightLeft size={16} /> Join
            </div>
          </div>

          <div className="node-group">
            <h4 className="group-title">Validation</h4>
            <div className="draggable-node" draggable onDragStart={(e) => onDragStart(e, 'validationNode', 'Not Null')}>
              <ShieldCheck size={16} /> Not Null Check
            </div>
          </div>

          <div className="node-group">
            <h4 className="group-title">Outputs</h4>
            <div className="draggable-node" draggable onDragStart={(e) => onDragStart(e, 'outputNode', 'CSV Output')}>
              <FileOutput size={16} /> CSV Output
            </div>
          </div>
        </div>

        <div className="builder-canvas" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#D9CFF8" gap={16} />
            <Controls />
            <MiniMap nodeColor="#7853EC" maskColor="rgba(244, 244, 252, 0.7)" />
          </ReactFlow>
        </div>

        {selectedNode && (
          <PropertiesPanel 
            node={selectedNode} 
            onClose={() => setSelectedNode(null)} 
          />
        )}
      </div>

      <div className={`bottom-panel ${isBottomPanelOpen ? 'open' : 'closed'}`}>
        <div className="bottom-panel-header">
          <div className="bottom-tabs">
            <button 
              className={`bottom-tab ${bottomTab === 'preview' ? 'active' : ''}`}
              onClick={() => { setBottomTab('preview'); setIsBottomPanelOpen(true); }}
            >
              <Table size={16} /> Data Preview
            </button>
            <button 
              className={`bottom-tab ${bottomTab === 'validation' ? 'active' : ''}`}
              onClick={() => { setBottomTab('validation'); setIsBottomPanelOpen(true); }}
            >
              <ShieldAlert size={16} /> Validation Center
            </button>
          </div>
          <button 
            className="text-muted text-sm font-semibold flex items-center gap-1 hover:text-primary" 
            style={{ padding: '4px 8px' }}
            onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
          >
            {isBottomPanelOpen ? 'Collapse ▼' : 'Expand ▲'}
          </button>
        </div>
        
        {isBottomPanelOpen && (
          <div className="bottom-panel-content">
            {bottomTab === 'preview' ? <DataPreview /> : <ValidationCenter />}
          </div>
        )}
      </div>
    </div>
  );
}
