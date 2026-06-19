import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Workflow, Settings, Database } from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Database size={24} color="#FFFFFF" />
        </div>
        <span className="logo-text">InGen</span>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink 
          to="/" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
          end
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        
        <NavLink 
          to="/builder" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <Workflow size={20} />
          <span>Pipeline Builder</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item">
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
