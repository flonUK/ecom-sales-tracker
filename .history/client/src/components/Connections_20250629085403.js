import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Connections.css';

const Connections = () => {
  const { token } = useContext(AuthContext);
  const [connections, setConnections] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showCredentials, setShowCredentials] = useState({
    etsy: false,
    ebay: false,
    amazon: false,
    swell: false
  });
  const [formData, setFormData] = useState({
    etsy: {},
    ebay: {},
    amazon: {},
    swell: {}
  });

  const platforms = useMemo(() => [
    {
      key: 'etsy',
      name: 'Etsy',
      icon: '🛍️',
      color: '#f56400',
      description: 'Connect your Etsy shop to sync sales data',
      features: ['Sales tracking', 'Order management', 'Revenue analytics'],
      fields: [
        { name: 'shop_name', label: 'Shop Name', type: 'text', required: true },
        { name: 'api_key', label: 'API Key', type: 'password', required: true },
        { name: 'api_secret', label: 'API Secret', type: 'password', required: true }
      ]
    },
    {
      key: 'ebay',
      name: 'eBay',
      icon: '📦',
      color: '#86b817',
      description: 'Connect your eBay store to sync sales data',
      features: ['Sales tracking', 'Order management', 'Revenue analytics'],
      fields: [
        { name: 'app_id', label: 'App ID', type: 'text', required: true },
        { name: 'cert_id', label: 'Cert ID', type: 'password', required: true },
        { name: 'dev_id', label: 'Dev ID', type: 'password', required: true },
        { name: 'auth_token', label: 'Auth Token', type: 'password', required: true }
      ]
    },
    {
      key: 'amazon',
      name: 'Amazon',
      icon: '📚',
      color: '#ff9900',
      description: 'Connect your Amazon seller account to sync sales data',
      features: ['Sales tracking', 'Order management', 'Revenue analytics'],
      fields: [
        { name: 'seller_id', label: 'Seller ID', type: 'text', required: true },
        { name: 'access_key', label: 'Access Key', type: 'password', required: true },
        { name: 'secret_key', label: 'Secret Key', type: 'password', required: true },
        { name: 'marketplace_id', label: 'Marketplace ID', type: 'text', required: true }
      ]
    },
    {
      key: 'swell',
      name: 'Swell',
      icon: '🛒',
      color: '#6366f1',
      description: 'Connect your Swell store to sync sales data',
      features: ['Sales tracking', 'Order management', 'Revenue analytics'],
      fields: [
        { name: 'store_id', label: 'Store ID', type: 'text', required: true },
        { name: 'public_key', label: 'Public Key', type: 'password', required: true },
        { name: 'secret_key', label: 'Secret Key', type: 'password', required: true }
      ]
    }
  ], []);

  const fetchConnections = useCallback(async () => {
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
  }, [token, platforms]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleConnect = async (platform) => {
    try {
      setConnecting(prev => ({ ...prev, [platform]: true }));
      setMessage({ type: '', text: '' });
      
      // Validate required fields
      const platformConfig = platforms.find(p => p.key === platform);
      const requiredFields = platformConfig.fields.filter(field => field.required);
      const missingFields = requiredFields.filter(field => !formData[platform][field.name]);
      
      if (missingFields.length > 0) {
        setMessage({ 
          type: 'error', 
          text: `Please fill in all required fields: ${missingFields.map(f => f.label).join(', ')}` 
        });
        return;
      }

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
        setMessage({ type: 'success', text: data.message || 'Connected successfully!' });
        setShowCredentials(prev => ({ ...prev, [platform]: false }));
        fetchConnections();
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

  const toggleCredentials = (platform) => {
    setShowCredentials(prev => ({ ...prev, [platform]: !prev[platform] }));
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
                {platforms.length}
              </span>
              <span className="stat-label">Available</span>
            </div>
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`message ${message.type}`}>
          <span className="message-icon">
            {message.type === 'success' ? '✅' : '❌'}
          </span>
          {message.text}
        </div>
      )}

      {/* Platform Grid */}
      <div className="platform-grid">
        {platforms.map((platform) => {
          const isConnected = connections[platform.key]?.connected;
          const isConnecting = connecting[platform.key];
          
          return (
            <div key={platform.key} className={`platform-card ${platform.key}`}>
              {/* Platform Header */}
              <div className="platform-header">
                <div className="platform-icon" style={{ backgroundColor: platform.color }}>
                  {platform.icon}
                </div>
                <div className="platform-info">
                  <h3>{platform.name}</h3>
                  <p>{platform.description}</p>
                </div>
              </div>

              {/* Connection Status */}
              <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                <div className={`status-icon ${isConnected ? 'connected' : 'disconnected'}`}>
                  {isConnected ? '✓' : '○'}
                </div>
                <span className={`status-text ${isConnected ? 'connected' : 'disconnected'}`}>
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              {/* Platform Features */}
              <div className="platform-features">
                <h4>Features</h4>
                <ul className="features-list">
                  {platform.features.map((feature, index) => (
                    <li key={index} className="feature-item">
                      <span className="feature-icon">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Credentials Form */}
              {showCredentials[platform.key] && (
                <div className="connection-form">
                  <h4>API Credentials</h4>
                  {platform.fields.map((field) => (
                    <div key={field.name} className="form-group">
                      <label className="form-label">
                        {field.label}
                        {field.required && <span className="required">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          className="form-input"
                          value={formData[platform.key][field.name] || ''}
                          onChange={(e) => handleInputChange(platform.key, field.name, e.target.value)}
                          required={field.required}
                        >
                          <option value="">Select {field.label}</option>
                          {field.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          className="form-input"
                          placeholder={field.placeholder}
                          value={formData[platform.key][field.name] || ''}
                          onChange={(e) => handleInputChange(platform.key, field.name, e.target.value)}
                          required={field.required}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="connection-actions">
                {isConnected ? (
                  <button
                    onClick={() => handleDisconnect(platform.key)}
                    className="disconnect-btn"
                    disabled={isConnecting}
                  >
                    Disconnect
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => toggleCredentials(platform.key)}
                      className="btn btn-outline"
                      disabled={isConnecting}
                    >
                      {showCredentials[platform.key] ? 'Cancel' : 'Add Credentials'}
                    </button>
                    {showCredentials[platform.key] && (
                      <button
                        onClick={() => handleConnect(platform.key)}
                        className="connect-btn"
                        disabled={isConnecting}
                      >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="help-section">
        <h2>Need Help?</h2>
        <p>Each platform requires specific API credentials. Here's how to get them:</p>
        <div className="help-grid">
          <div className="help-card">
            <h3>Etsy</h3>
            <p>Create an app in your Etsy account and get your API credentials from the developer portal.</p>
          </div>
          <div className="help-card">
            <h3>eBay</h3>
            <p>Register as an eBay developer and create an application to get your API credentials.</p>
          </div>
          <div className="help-card">
            <h3>Amazon</h3>
            <p>Set up AWS credentials and configure your Seller Central account for API access.</p>
          </div>
          <div className="help-card">
            <h3>Swell</h3>
            <p>Get your API credentials from your Swell dashboard under Settings > API.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Connections; 