import React from 'react';
import { X } from 'lucide-react';
import './PropertiesPanel.css';

export default function PropertiesPanel({ node, onClose }) {
  const isFilter = node.data.label.includes('Filter');
  const isJoin = node.data.label.includes('Join');
  const isOutput = node.type === 'outputNode';

  return (
    <div className="properties-panel">
      <div className="panel-header">
        <h3 className="font-semibold">{node.data.label} Configuration</h3>
        <button className="icon-btn" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="panel-body">
        <div className="input-group">
          <label className="input-label">Node Name</label>
          <input className="input-field" type="text" defaultValue={node.data.label} />
        </div>

        {isFilter && (
          <>
            <div className="input-group">
              <label className="input-label">Column</label>
              <select className="input-field">
                <option>status</option>
                <option>amount</option>
                <option>date</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Operator</label>
              <select className="input-field">
                <option>Equals</option>
                <option>Not Equals</option>
                <option>Greater Than</option>
                <option>Less Than</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Value</label>
              <input className="input-field" type="text" placeholder="e.g. Active" />
            </div>
          </>
        )}

        {isJoin && (
          <>
            <div className="input-group">
              <label className="input-label">Join Type</label>
              <select className="input-field">
                <option>Inner Join</option>
                <option>Left Join</option>
                <option>Right Join</option>
                <option>Full Outer Join</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Left Key</label>
              <input className="input-field" type="text" placeholder="e.g. user_id" />
            </div>
            <div className="input-group">
              <label className="input-label">Right Key</label>
              <input className="input-field" type="text" placeholder="e.g. account_id" />
            </div>
          </>
        )}

        {isOutput && (
          <>
            <div className="input-group">
              <label className="input-label">Destination</label>
              <select className="input-field">
                <option>Local File</option>
                <option>S3 Bucket</option>
                <option>Database</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Filename</label>
              <input className="input-field" type="text" placeholder="e.g. output.csv" />
            </div>
            <div className="input-group">
              <label className="input-label">Path</label>
              <input className="input-field" type="text" placeholder="/data/out/" />
            </div>
          </>
        )}

        <div className="panel-footer pt-4">
          <button className="btn btn-primary w-full">Save Configuration</button>
        </div>
      </div>
    </div>
  );
}
