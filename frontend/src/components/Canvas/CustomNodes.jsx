import React from 'react';
import { Handle, Position } from 'reactflow';
import { Database, Filter, FileOutput, ShieldCheck } from 'lucide-react';
import './CustomNodes.css';

const BaseNode = ({ data, icon, title, typeColor }) => (
  <div className="custom-node card">
    <div className="node-header" style={{ borderLeftColor: typeColor }}>
      <div className="node-icon" style={{ color: typeColor, backgroundColor: `${typeColor}20` }}>
        {icon}
      </div>
      <div className="node-title">
        <div className="font-semibold">{data.label}</div>
        <div className="text-xs text-muted">{data.type || 'Node'}</div>
      </div>
    </div>
  </div>
);

export const SourceNode = ({ data }) => (
  <>
    <BaseNode data={data} icon={<Database size={16} />} typeColor="#3b82f6" />
    <Handle type="source" position={Position.Right} className="custom-handle" />
  </>
);

export const TransformNode = ({ data }) => (
  <>
    <Handle type="target" position={Position.Left} className="custom-handle" />
    <BaseNode data={data} icon={<Filter size={16} />} typeColor="#f59e0b" />
    <Handle type="source" position={Position.Right} className="custom-handle" />
  </>
);

export const ValidationNode = ({ data }) => (
  <>
    <Handle type="target" position={Position.Left} className="custom-handle" />
    <BaseNode data={data} icon={<ShieldCheck size={16} />} typeColor="#10b981" />
    <Handle type="source" position={Position.Right} className="custom-handle" />
  </>
);

export const OutputNode = ({ data }) => (
  <>
    <Handle type="target" position={Position.Left} className="custom-handle" />
    <BaseNode data={data} icon={<FileOutput size={16} />} typeColor="#8b5cf6" />
  </>
);

export default { SourceNode, TransformNode, ValidationNode, OutputNode };
