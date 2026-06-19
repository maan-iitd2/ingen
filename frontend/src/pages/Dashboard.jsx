import React from 'react';
import { 
  Activity, CheckCircle2, XCircle, Workflow, 
  ArrowUpRight, ArrowDownRight, Plus, Upload, Play
} from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  return (
    <div className="dashboard-container">
      <div className="section-header">
        <h1>Overview</h1>
        <button className="btn btn-primary">
          <Plus size={16} />
          New Pipeline
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="card metric-card">
          <div className="metric-title">
            <Workflow size={18} />
            Total Pipelines
          </div>
          <div className="metric-value">24</div>
          <div className="metric-change positive">
            <ArrowUpRight size={16} />
            <span>12% from last month</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-title">
            <Activity size={18} />
            Recent Executions
          </div>
          <div className="metric-value">1,432</div>
          <div className="metric-change positive">
            <ArrowUpRight size={16} />
            <span>5% from yesterday</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-title">
            <CheckCircle2 size={18} />
            Success Rate
          </div>
          <div className="metric-value">98.5%</div>
          <div className="metric-change positive">
            <ArrowUpRight size={16} />
            <span>0.5% from last week</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-title">
            <XCircle size={18} />
            Validation Failures
          </div>
          <div className="metric-value">21</div>
          <div className="metric-change negative">
            <ArrowDownRight size={16} />
            <span>3% from yesterday</span>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="card">
          <div className="section-header">
            <h2 className="section-title">Recent Executions</h2>
            <button className="btn btn-secondary">View All</button>
          </div>
          
          <div className="execution-list">
            {[
              { id: 'EXE-8901', name: 'Daily Customer Sync', status: 'Success', time: '10 mins ago', type: 'Database' },
              { id: 'EXE-8902', name: 'Vendor XML to CSV', status: 'Failed', time: '45 mins ago', type: 'File' },
              { id: 'EXE-8903', name: 'Product Analytics Aggregation', status: 'Success', time: '2 hours ago', type: 'API' },
              { id: 'EXE-8904', name: 'Weekly Marketing Extract', status: 'Success', time: '5 hours ago', type: 'Database' }
            ].map((exe, i) => (
              <div className="list-item" key={i}>
                <div className="item-left">
                  <div className="icon-box">
                    <Workflow size={20} />
                  </div>
                  <div>
                    <div className="item-title">{exe.name}</div>
                    <div className="item-subtitle">{exe.id} • {exe.type}</div>
                  </div>
                </div>
                <div className="item-right flex items-center gap-4">
                  <span className={`badge ${exe.status === 'Success' ? 'badge-success' : 'badge-danger'}`}>
                    {exe.status}
                  </span>
                  <span className="text-sm text-muted">{exe.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <h2 className="section-title">Quick Actions</h2>
          </div>
          <div>
            <button className="btn btn-secondary quick-action">
              <Plus size={18} style={{ color: 'var(--color-primary)' }} />
              Create Blank Pipeline
            </button>
            <button className="btn btn-secondary quick-action">
              <Upload size={18} style={{ color: 'var(--color-primary)' }} />
              Import Configuration
            </button>
            <button className="btn btn-secondary quick-action">
              <Play size={18} style={{ color: 'var(--color-primary)' }} />
              Trigger Execution
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
