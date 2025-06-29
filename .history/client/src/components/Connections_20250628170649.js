import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Connections.css';

const Connections = () => {
  const { token } = useContext(AuthContext);
  const [connections, setConnections] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });
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
      placeholder: 'https://www.etsy.com/shop/your-shop-name',
      features: ['Sales tracking', 'Product analytics', 'Revenue insights']
    },
    {
      name: 'eBay',
      key: 'ebay',
      color: '#86B817',
      icon: '📦',
      description: 'Connect your eBay account to sync sales data',
      placeholder: 'Your eBay username',
      features: ['Order management', 'Performance metrics', 'Market analysis']
    },
    {
      name: 'Amazon',
      key: 'amazon',
      color: '#FF9900',
      icon: '📚',
      description: 'Connect your Amazon Seller account to sync sales data',
      placeholder: 'Your Amazon Seller ID',
      features: ['FBA tracking', 'Inventory insights', 'Competitive analysis']
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
      setMessage({ type: '', text: '' });
      
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
          setMessage({ type: 'success', text: data.message || 'Connected successfully!' });
          fetchConnections();
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to connect' });
      }
    } catch (error) {
      console.error(`Error connecting ${platform}:`, error);
      setMessage({ type: 'error', text: 'Failed to connect. Please try again.' });
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
        setMessage({ type: 'success', text: `${platform} disconnected successfully` });
        fetchConnections();
      } else {
        setMessage({ type: 'error', text: 'Failed to disconnect' });
      }
    } catch (error) {
      console.error(`Error disconnecting ${platform}:`, error);
      setMessage({ type: 'error', text: 'Failed to disconnect. Please try again.' });
    }
  };

  const handleInputChange = (platform, field, value) => {
    setFormData(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value }
    }));
    // Clear any previous messages when user starts typing
    if (message.text) {
      setMessage({ type: '', text: '' });
    }
  };

  if (loading) {
    return (
      <div className="connections-container">
        <div className="connections-loading">
          <div className="loading-spinner"></div>
          <p>Loading platform connections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="connections-container">
      {/* Header */}
      <div className="connections-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Platform Connections</h1>
            <p>Connect your marketplace accounts to sync sales data</p>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-number">
                {Object.values(connections).filter(c => c.connected).length}
              </span>
              <span className="stat-label">Connected</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">
                {Object.values(connections).filter(c => c.connected && c.demoMode !== false).length}
              </span>
              <span className="stat-label">Sample Data</span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Mode Banner */}
      <div className="demo-banner">
        <div className="banner-content">
          <div className="banner-icon">🎯</div>
          <div className="banner-text">
            <h3>Sample Data Mode Active</h3>
            <p>You're currently using sample data for testing. Add real API credentials to your <code>.env</code> file to switch to live data.</p>
          </div>
          <div className="banner-actions">
            <button className="info-btn" onClick={() => document.getElementById('help-section').scrollIntoView({ behavior: 'smooth' })}>
              Learn More
            </button>
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Platforms Grid */}
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
                  <div className="platform-features">
                    {platform.features.map((feature, index) => (
                      <span key={index} className="feature-tag">{feature}</span>
                    ))}
                  </div>
                </div>
                <div className="connection-status">
                  {isConnected ? (
                    <div className="status-badge connected">
                      <span className="status-dot"></span>
                      <span>Connected</span>
                      {isDemoMode && <span className="demo-indicator">Sample</span>}
                    </div>
                  ) : (
                    <div className="status-badge disconnected">
                      <span className="status-dot"></span>
                      <span>Not Connected</span>
                    </div>
                  )}
                </div>
              </div>

              {isDemoMode && isConnected && (
                <div className="demo-notice">
                  <span className="notice-icon">🎯</span>
                  <span>Using sample data for testing</span>
                </div>
              )}

              {!isConnected ? (
                <div className="connection-form">
                  <div className="input-group">
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
                      {isConnecting ? (
                        <div className="loading-content">
                          <div className="spinner"></div>
                          <span>Connecting...</span>
                        </div>
                      ) : (
                        <>
                          <span className="btn-icon">🔗</span>
                          Connect
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="connection-actions">
                  <div className="connection-details">
                    <div className="detail-item">
                      <span className="detail-label">Last Sync:</span>
                      <span className="detail-value">
                        {connection.lastSync ? new Date(connection.lastSync).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                    {isDemoMode && (
                      <div className="detail-item">
                        <span className="detail-label">Mode:</span>
                        <span className="detail-value demo">Sample Data</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDisconnect(platform.key)}
                    className="disconnect-btn"
                  >
                    <span className="btn-icon">❌</span>
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div id="help-section" className="help-section">
        <div className="help-header">
          <h2>Getting Started</h2>
          <p>Learn how to connect your marketplace accounts</p>
        </div>
        
        <div className="help-grid">
          <div className="help-card">
            <div className="help-icon">🎯</div>
            <h3>Sample Data Mode</h3>
            <p>Perfect for testing the app without setting up real API credentials. You can see how the app works with realistic sample data.</p>
            <ul>
              <li>No API setup required</li>
              <li>Realistic sample data</li>
              <li>Full app functionality</li>
            </ul>
          </div>
          
          <div className="help-card">
            <div className="help-icon">🔗</div>
            <h3>Real Data Mode</h3>
            <p>Connect your actual marketplace accounts to sync real sales data. Requires API credentials from each platform.</p>
            <ul>
              <li>Live sales data</li>
              <li>Real-time analytics</li>
              <li>Complete integration</li>
            </ul>
          </div>
          
          <div className="help-card">
            <div className="help-icon">⚙️</div>
            <h3>Setup Instructions</h3>
            <p>To switch from sample data to real data, follow these steps:</p>
            <ol>
              <li>Register apps on Etsy, eBay, and Amazon developer portals</li>
              <li>Add your API credentials to the backend <code>.env</code> file</li>
              <li>Restart the backend server</li>
              <li>Reconnect your platforms</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Connections; 