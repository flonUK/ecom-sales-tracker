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
  const [testingConnection, setTestingConnection] = useState({});

  const platforms = useMemo(() => [
    {
      key: 'etsy',
      name: 'Etsy',
      icon: '🛍️',
      color: '#f56400',
      description: 'Connect your Etsy shop to sync sales data',
      features: ['Sales tracking', 'Order management', 'Revenue analytics'],
      helpUrl: 'https://www.etsy.com/developers/documentation/getting_started/register',
      fields: [
        { name: 'shop_name', label: 'Shop Name', type: 'text', required: true, placeholder: 'your-shop-name' },
        { name: 'api_key', label: 'API Key', type: 'password', required: true, placeholder: 'Enter your Etsy API key' },
        { name: 'api_secret', label: 'API Secret', type: 'password', required: true, placeholder: 'Enter your Etsy API secret' }
      ]
    },
    {
      key: 'ebay',
      name: 'eBay',
      icon: '📦',
      color: '#86b817',
      description: 'Connect your eBay store to sync sales data',
      features: ['Sales tracking', 'Order management', 'Revenue analytics'],
      helpUrl: 'https://developer.ebay.com/docs/develop/apis/overview/',
      fields: [
        { name: 'app_id', label: 'App ID', type: 'text', required: true, placeholder: 'Enter your eBay App ID' },
        { name: 'cert_id', label: 'Cert ID', type: 'password', required: true, placeholder: 'Enter your eBay Cert ID' },
        { name: 'dev_id', label: 'Dev ID', type: 'password', required: true, placeholder: 'Enter your eBay Dev ID' },
        { name: 'auth_token', label: 'Auth Token', type: 'password', required: true, placeholder: 'Enter your eBay Auth Token' }
      ]
    },
    {
      key: 'amazon',
      name: 'Amazon',
      icon: '📚',
      color: '#ff9900',
      description: 'Connect your Amazon seller account to sync sales data',
      features: ['Sales tracking', 'Order management', 'Revenue analytics'],
      helpUrl: 'https://developer.amazonservices.com/',
      fields: [
        { name: 'seller_id', label: 'Seller ID', type: 'text', required: true, placeholder: 'Enter your Amazon Seller ID' },
        { name: 'access_key', label: 'Access Key', type: 'password', required: true, placeholder: 'Enter your AWS Access Key' },
        { name: 'secret_key', label: 'Secret Key', type: 'password', required: true, placeholder: 'Enter your AWS Secret Key' },
        { name: 'marketplace_id', label: 'Marketplace ID', type: 'text', required: true, placeholder: 'e.g., A1F83G8C2ARO7P' }
      ]
    },
    {
      key: 'swell',
      name: 'Swell',
      icon: '🛒',
      color: '#6366f1',
      description: 'Connect your Swell store to sync sales data',
      features: ['Sales tracking', 'Order management', 'Revenue analytics'],
      helpUrl: 'https://developers.swell.store/',
      fields: [
        { name: 'storeId', label: 'Store ID', type: 'text', required: true, placeholder: 'Enter your Swell Store ID' },
        { name: 'publicKey', label: 'Public Key', type: 'password', required: true, placeholder: 'Enter your Swell Public Key' },
        { name: 'secretKey', label: 'Secret Key', type: 'password', required: true, placeholder: 'Enter your Swell Secret Key' }
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
      setMessage({ type: 'error', text: 'Failed to load connection status. Please refresh the page.' });
    } finally {
      setLoading(false);
    }
  }, [token, platforms]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const testConnection = async (platform) => {
    try {
      setTestingConnection(prev => ({ ...prev, [platform]: true }));
      setMessage({ type: '', text: '' });
      
      const response = await fetch(`/api/${platform}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData[platform])
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `${platform} connection test successful!` });
      } else {
        setMessage({ type: 'error', text: data.error || `Failed to test ${platform} connection` });
      }
    } catch (error) {
      console.error(`Error testing ${platform} connection:`, error);
      setMessage({ type: 'error', text: `Network error testing ${platform} connection` });
    } finally {
      setTestingConnection(prev => ({ ...prev, [platform]: false }));
    }
  };

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
        setMessage({ type: 'success', text: data.message || `${platform} connected successfully!` });
        setShowCredentials(prev => ({ ...prev, [platform]: false }));
        fetchConnections();
      } else {
        setMessage({ type: 'error', text: data.error || `Failed to connect ${platform}` });
      }
    } catch (error) {
      console.error(`Error connecting ${platform}:`, error);
      setMessage({ type: 'error', text: `Network error connecting ${platform}. Please try again.` });
    } finally {
      setConnecting(prev => ({ ...prev, [platform]: false }));
    }
  };

  const handleDisconnect = async (platform) => {
    if (!window.confirm(`Are you sure you want to disconnect ${platform}? This will remove all stored credentials.`)) {
      return;
    }

    try {
      setConnecting(prev => ({ ...prev, [platform]: true }));
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
    } finally {
      setConnecting(prev => ({ ...prev, [platform]: false }));
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

  const getConnectionStatus = (platform) => {
    const connection = connections[platform];
    if (!connection) return { status: 'unknown', text: 'Unknown', color: '#6b7280' };
    
    if (connection.connected) {
      return { status: 'connected', text: 'Connected', color: '#10b981' };
    } else if (connection.error) {
      return { status: 'error', text: 'Error', color: '#ef4444' };
    } else {
      return { status: 'disconnected', text: 'Not Connected', color: '#6b7280' };
    }
  };

  if (loading) {
    return (
      <div className="connections-container">
        <div className="connections-loading">
          <div className="loading-spinner"></div>
          <p>Loading platform connections...</p>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
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
            {message.type === 'success' ? '✅' : message.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} className="message-close">×</button>
        </div>
      )}

      {/* Platform Grid */}
      <div className="platform-grid">
        {platforms.map((platform) => {
          const isConnected = connections[platform.key]?.connected;
          const isConnecting = connecting[platform.key];
          const isTesting = testingConnection[platform.key];
          const connectionStatus = getConnectionStatus(platform.key);
          
          return (
            <div key={platform.key} className={`platform-card ${platform.key} ${connectionStatus.status}`}>
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
              <div className={`connection-status ${connectionStatus.status}`}>
                <div className={`status-icon ${connectionStatus.status}`}>
                  {connectionStatus.status === 'connected' ? '✓' : 
                   connectionStatus.status === 'error' ? '⚠' : '○'}
                </div>
                <span className={`status-text ${connectionStatus.status}`}>
                  {connectionStatus.text}
                </span>
                {connections[platform.key]?.lastSync && (
                  <span className="last-sync">
                    Last sync: {new Date(connections[platform.key].lastSync).toLocaleDateString()}
                  </span>
                )}
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
                  <p className="form-description">
                    Enter your {platform.name} API credentials below. 
                    <a href={platform.helpUrl} target="_blank" rel="noopener noreferrer" className="help-link">
                      Need help getting credentials?
                    </a>
                  </p>
                  {platform.fields.map((field) => (
                    <div key={field.name} className="form-group">
                      <label className="form-label">
                        {field.label}
                        {field.required && <span className="required">*</span>}
                      </label>
                      <input
                        type={field.type}
                        className="form-input"
                        placeholder={field.placeholder}
                        value={formData[platform.key][field.name] || ''}
                        onChange={(e) => handleInputChange(platform.key, field.name, e.target.value)}
                        required={field.required}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="connection-actions">
                {isConnected ? (
                  <div className="connected-actions">
                    <button
                      onClick={() => handleDisconnect(platform.key)}
                      className="disconnect-btn"
                      disabled={isConnecting}
                    >
                      {isConnecting ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                    <button
                      onClick={() => window.location.href = '/dashboard'}
                      className="view-data-btn"
                    >
                      View Data
                    </button>
                  </div>
                ) : (
                  <div className="disconnected-actions">
                    <button
                      onClick={() => toggleCredentials(platform.key)}
                      className="btn btn-outline"
                      disabled={isConnecting}
                    >
                      {showCredentials[platform.key] ? 'Cancel' : 'Add Credentials'}
                    </button>
                    {showCredentials[platform.key] && (
                      <>
                        <button
                          onClick={() => testConnection(platform.key)}
                          className="test-btn"
                          disabled={isTesting}
                        >
                          {isTesting ? 'Testing...' : 'Test Connection'}
                        </button>
                        <button
                          onClick={() => handleConnect(platform.key)}
                          className="connect-btn"
                          disabled={isConnecting}
                        >
                          {isConnecting ? 'Connecting...' : 'Connect'}
                        </button>
                      </>
                    )}
                  </div>
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
            <a href="https://www.etsy.com/developers/documentation/getting_started/register" target="_blank" rel="noopener noreferrer" className="help-link">
              Get Etsy API Credentials →
            </a>
          </div>
          <div className="help-card">
            <h3>eBay</h3>
            <p>Register as an eBay developer and create an application to get your API credentials.</p>
            <a href="https://developer.ebay.com/docs/develop/apis/overview/" target="_blank" rel="noopener noreferrer" className="help-link">
              Get eBay API Credentials →
            </a>
          </div>
          <div className="help-card">
            <h3>Amazon</h3>
            <p>Set up AWS credentials and configure your Seller Central account for API access.</p>
            <a href="https://developer.amazonservices.com/" target="_blank" rel="noopener noreferrer" className="help-link">
              Get Amazon API Credentials →
            </a>
          </div>
          <div className="help-card">
            <h3>Swell</h3>
            <p>Get your API credentials from your Swell dashboard under Settings > API.</p>
            <a href="https://developers.swell.store/" target="_blank" rel="noopener noreferrer" className="help-link">
              Get Swell API Credentials →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Connections; 