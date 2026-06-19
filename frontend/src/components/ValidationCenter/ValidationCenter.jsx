import React from 'react';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import './ValidationCenter.css';

export default function ValidationCenter() {
  return (
    <div className="validation-container flex gap-6 h-full w-full">
      <div className="validation-sidebar">
        <h3 className="font-semibold mb-4">Validation Summary</h3>
        <div className="flex justify-between items-center mb-2">
          <span className="text-muted">Passed Rules</span>
          <span className="text-success font-semibold flex items-center gap-1"><CheckCircle2 size={16}/> 18</span>
        </div>
        <div className="flex justify-between items-center mb-4">
          <span className="text-muted">Failed Rules</span>
          <span className="text-danger font-semibold flex items-center gap-1"><XCircle size={16}/> 2</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{width: '90%'}}></div>
        </div>
      </div>
      <div className="validation-content flex-1">
        <h3 className="font-semibold mb-4 flex items-center gap-2 text-danger" style={{ color: 'var(--color-danger)' }}>
          <AlertCircle size={18} /> Error Details
        </h3>
        <div className="card mb-4 p-4" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div className="font-semibold mb-1">Column "email" - Not Null Check Failed</div>
          <div className="text-sm text-muted">Found 12 null values in the dataset. Expected 0.</div>
        </div>
        <div className="card p-4" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div className="font-semibold mb-1">Column "amount" - Range Check Warning</div>
          <div className="text-sm text-muted">3 values found outside the typical range (0 - 1000).</div>
        </div>
      </div>
    </div>
  );
}
