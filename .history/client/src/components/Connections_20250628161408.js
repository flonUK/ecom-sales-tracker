import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Connections.css';

const Connections = () => {
  const { token } = useContext(AuthContext);
  const [connections, setConnections] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState({});
  const [formData, setFormData] = useState({
    etsy: { shopUrl: '' },
    ebay: { username: '' },
    amazon: { sellerId: '' }
  });

  const platforms = [
    {
      name: 'Etsy',
      key: 'etsy',
      color: '#F56400',
      icon: '🛍️',
      description: 'Connect your Etsy shop to sync sales data',
      placeholder: 'https://www.etsy.com/shop/your-shop-name'
    },
    {
      name: 'eBay',
      key: 'ebay',
      color: '#86B817',
      icon: '📦',
      description: 'Connect your eBay account to sync sales data',
      placeholder: 'Your eBay username'
    },
    {
      name: 'Amazon',
      key: 'amazon',
      color: '#FF9900',
      icon: '📚',
      description: 'Connect your Amazon Seller account to sync sales data',
      placeholder: 'Your Amazon Seller ID'
    }
  ];

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const promises = platforms.map(async (platform) => {
        try {
          const response = await fetch(`/api/${platform.key}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            return { [platform.key]: data };
          }
        } catch (error) {
          console.error(`Error fetching ${platform.key} status:`, error);
        }
        return { [platform.key]: { connected: false } };
      });

      const results = await Promise.all(promises);
      const connectionsData = results.reduce((acc, result) => ({ ...acc, ...result }), {});
      setConnections(connectionsData);
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform) => {
    try {
      setConnecting(prev => ({ ...prev, [platform]: true }));
      
      const response = await fetch(`/api/${platform}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData[platform])
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresOAuth) {
          // Handle OAuth flow
          const authResponse = await fetch(`/api/${platform}/auth-url`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const authData = await authResponse.json();
          
          if (authData.authUrl) {
            window.location.href = authData.authUrl;
          }
        } else {
          // Sample data mode or direct connection
          alert(data.message);
          fetchConnections();
        }
      } else {
        alert(data.error || 'Failed to connect');
      }
    } catch (error) {
      console.error(`Error connecting ${platform}:`, error);
      alert('Failed to connect. Please try again.');
    } finally {
      setConnecting(prev => ({ ...prev, [platform]: false }));
    }
  };

  const handleDisconnect = async (platform) => {
    if (!window.confirm(`Are you sure you want to disconnect ${platform}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/${platform}/disconnect`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        alert(`${platform} disconnected successfully`);
        fetchConnections();
      } else {
        alert('Failed to disconnect');
      }
    } catch (error) {
      console.error(`Error disconnecting ${platform}:`, error);
      alert('Failed to disconnect. Please try again.');
    }
  };

  const handleInputChange = (platform, field, value) => {
    setFormData(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value }
    }));
  };

  if (loading) {
    return (
      <div className="connections-container">
        <h2>Platform Connections</h2>
        <div className="loading">Loading connections...</div>
      </div>
    );
  }

  return (
    <div className="connections-container">
      <h2>Platform Connections</h2>
      
      <div className="demo-mode-banner">
        <div className="demo-mode-content">
          <span className="demo-icon">🎯</span>
          <div>
            <h3>Sample Data Mode Active</h3>
            <p>You're currently using sample data for testing. Add real API credentials to your <code>.env</code> file to switch to live data.</p>
            <div className="demo-instructions">
              <strong>To enable real data:</strong>
              <ul>
                <li>Register apps on Etsy, eBay, and Amazon developer portals</li>
                <li>Add your API credentials to the backend <code>.env</code> file</li>
                <li>Restart the backend server</li>
                <li>Reconnect your platforms</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="platforms-grid">
        {platforms.map((platform) => {
          const connection = connections[platform.key] || {};
          const isConnected = connection.connected;
          const isDemoMode = connection.demoMode !== false; // Default to demo mode
          const isConnecting = connecting[platform.key];

          return (
            <div key={platform.key} className={`platform-card ${isConnected ? 'connected' : ''} ${isDemoMode ? 'demo-mode' : 'real-mode'}`}>
              <div className="platform-header">
                <div className="platform-icon" style={{ backgroundColor: platform.color }}>
                  {platform.icon}
                </div>
                <div className="platform-info">
                  <h3>{platform.name}</h3>
                  <p>{platform.description}</p>
                </div>
                <div className="connection-status">
                  {isConnected ? (
                    <span className="status-badge connected">
                      ✓ Connected
                      {isDemoMode && <span className="demo-indicator">Sample Data</span>}
                    </span>
                  ) : (
                    <span className="status-badge disconnected">Not Connected</span>
                  )}
                </div>
              </div>

              {isDemoMode && (
                <div className="demo-notice">
                  <span className="demo-icon">🎯</span>
                  <span>Using sample data for testing</span>
                </div>
              )}

              {!isConnected ? (
                <div className="connection-form">
                  <input
                    type="text"
                    placeholder={platform.placeholder}
                    value={formData[platform.key][Object.keys(formData[platform.key])[0]] || ''}
                    onChange={(e) => handleInputChange(platform.key, Object.keys(formData[platform.key])[0], e.target.value)}
                    className="connection-input"
                  />
                  <button
                    onClick={() => handleConnect(platform.key)}
                    disabled={isConnecting}
                    className="connect-btn"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              ) : (
                <div className="connection-actions">
                  <div className="connection-details">
                    <p><strong>Last Sync:</strong> {connection.lastSync ? new Date(connection.lastSync).toLocaleDateString() : 'Never'}</p>
                    {isDemoMode && (
                      <p className="demo-note">
                        <em>Sample data mode - Add API credentials to .env for real data</em>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDisconnect(platform.key)}
                    className="disconnect-btn"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="help-section">
        <h3>Need Help?</h3>
        <div className="help-content">
          <div className="help-item">
            <h4>🎯 Sample Data Mode</h4>
            <p>Perfect for testing the app without setting up real API credentials. You can see how the app works with realistic sample data.</p>
          </div>
          <div className="help-item">
            <h4>🔗 Real Data Mode</h4>
            <p>Connect your actual marketplace accounts to sync real sales data. Requires API credentials from each platform.</p>
          </div>
          <div className="help-item">
            <h4>🔄 Switching Modes</h4>
            <p>Add your API credentials to the backend <code>.env</code> file and restart the server to automatically switch to real data mode.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Connections; 