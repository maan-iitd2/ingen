import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import './Header.css';

export default function Header() {
  return (
    <header className="header">
      <div className="header-search">
        <Search size={18} className="search-icon" />
        <input type="text" placeholder="Search pipelines, executions..." className="search-input" />
      </div>
      
      <div className="header-actions">
        <button className="icon-btn relative">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>
        <div className="user-avatar">
          <User size={20} color="#FFFFFF" />
        </div>
      </div>
    </header>
  );
}
