import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { logout } = useContext(AuthContext);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/sales', label: 'Sales', icon: '📦' },
    { path: '/analytics', label: 'Analytics', icon: '📈' },
    { path: '/connections', label: 'Connections', icon: '🔗' },
    { path: '/profile', label: 'Profile', icon: '👤' }
  ];

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="navbar">
      <div className="navbar-header">
        <div className="navbar-brand">
          <div className="brand-icon">💰</div>
          <div className="brand-text">
            <h1>EcomTracker</h1>
            <p>Multi-Platform Sales</p>
          </div>
        </div>
      </div>

      <div className="navbar-menu">
        <ul className="nav-list">
          {navItems.map((item) => (
            <li key={item.path} className="nav-item">
              <Link
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="navbar-footer">
        <button onClick={handleLogout} className="logout-btn">
          <span className="logout-icon">🚪</span>
          <span className="logout-label">Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar; 