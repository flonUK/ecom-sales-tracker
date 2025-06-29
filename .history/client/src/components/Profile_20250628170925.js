import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Profile.css';

const Profile = () => {
  const { user, token } = useContext(AuthContext);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
    // Clear any previous messages when user starts typing
    if (message.text) {
      setMessage({ type: '', text: '' });
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Password updated successfully!' });
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysAsMember = () => {
    if (!user?.created_at) return 0;
    const created = new Date(user.created_at);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="profile-container">
      {/* Header */}
      <div className="profile-header">
        <div className="header-content">
          <div className="avatar-section">
            <div className="avatar">
              <span className="avatar-text">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="user-info">
              <h1>{user?.username || 'User'}</h1>
              <p>{user?.email || 'user@example.com'}</p>
              <span className="member-since">
                Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
          <div className="status-badge active">
            <span className="status-dot"></span>
            Active Account
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="profile-content">
        {/* Account Information */}
        <div className="profile-card">
          <div className="card-header">
            <h2>Account Information</h2>
            <p>Your basic account details</p>
          </div>
          
          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">
                <span className="info-icon">👤</span>
                Username
              </div>
              <div className="info-value">{user?.username || 'N/A'}</div>
            </div>

            <div className="info-item">
              <div className="info-label">
                <span className="info-icon">📧</span>
                Email Address
              </div>
              <div className="info-value">{user?.email || 'N/A'}</div>
            </div>

            <div className="info-item">
              <div className="info-label">
                <span className="info-icon">🆔</span>
                User ID
              </div>
              <div className="info-value">{user?.id || 'N/A'}</div>
            </div>

            <div className="info-item">
              <div className="info-label">
                <span className="info-icon">📅</span>
                Member Since
              </div>
              <div className="info-value">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="profile-card">
          <div className="card-header">
            <h2>Change Password</h2>
            <p>Update your account password</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="password-form">
            {message.text && (
              <div className={`message ${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="currentPassword">
                <span className="label-icon">🔒</span>
                Current Password
              </label>
              <div className="input-wrapper">
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  className="form-input"
                  placeholder="Enter your current password"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">
                <span className="label-icon">🔑</span>
                New Password
              </label>
              <div className="input-wrapper">
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  className="form-input"
                  placeholder="Enter your new password"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <div className="password-hint">
                Password must be at least 6 characters long
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                <span className="label-icon">✅</span>
                Confirm New Password
              </label>
              <div className="input-wrapper">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  className="form-input"
                  placeholder="Confirm your new password"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="submit-btn"
            >
              {isLoading ? (
                <div className="loading-content">
                  <div className="spinner"></div>
                  <span>Updating Password...</span>
                </div>
              ) : (
                <>
                  <span className="btn-icon">💾</span>
                  Update Password
                </>
              )}
            </button>
          </form>
        </div>

        {/* Account Statistics */}
        <div className="profile-card">
          <div className="card-header">
            <h2>Account Statistics</h2>
            <p>Your account overview</p>
          </div>
          
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-icon">🟢</div>
              <div className="stat-content">
                <div className="stat-value">Active</div>
                <div className="stat-label">Account Status</div>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-value">{getDaysAsMember()}</div>
                <div className="stat-label">Days as Member</div>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <div className="stat-value">Verified</div>
                <div className="stat-label">Email Status</div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Information */}
        <div className="profile-card">
          <div className="card-header">
            <h2>Security Information</h2>
            <p>How we protect your account</p>
          </div>
          
          <div className="security-list">
            <div className="security-item">
              <div className="security-icon">🔐</div>
              <div className="security-content">
                <h4>JWT Authentication</h4>
                <p>Your account is secured with industry-standard JWT tokens</p>
              </div>
            </div>
            
            <div className="security-item">
              <div className="security-icon">🔒</div>
              <div className="security-content">
                <h4>Password Hashing</h4>
                <p>All passwords are securely hashed using bcrypt</p>
              </div>
            </div>
            
            <div className="security-item">
              <div className="security-icon">🔑</div>
              <div className="security-content">
                <h4>API Security</h4>
                <p>API credentials are encrypted and stored securely</p>
              </div>
            </div>
            
            <div className="security-item">
              <div className="security-icon">🌐</div>
              <div className="security-content">
                <h4>HTTPS Communication</h4>
                <p>All API communications use secure HTTPS protocol</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 