import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMutation } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  User, 
  Mail, 
  Calendar, 
  Lock, 
  Eye, 
  EyeOff,
  Save,
  Key
} from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const changePasswordMutation = useMutation(
    async (data) => {
      const response = await axios.put('/api/auth/change-password', data);
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success('Password updated successfully');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update password');
      }
    }
  );

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      {/* User Information */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="form-label">Username</label>
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={user?.username || ''}
                disabled
                className="form-input bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Email</label>
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="form-input bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Member Since</label>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ''}
                disabled
                className="form-input bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="form-label">User ID</label>
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={user?.id || ''}
                disabled
                className="form-input bg-gray-50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
        
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="form-label">
              Current Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="currentPassword"
                name="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                required
                className="form-input pl-10 pr-10"
                placeholder="Enter your current password"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="newPassword" className="form-label">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="newPassword"
                name="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                required
                className="form-input pl-10 pr-10"
                placeholder="Enter your new password"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Password must be at least 6 characters long
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="form-label">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                className="form-input pl-10 pr-10"
                placeholder="Confirm your new password"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={changePasswordMutation.isLoading}
              className="btn btn-primary"
            >
              {changePasswordMutation.isLoading ? (
                <div className="flex items-center">
                  <div className="spinner mr-2"></div>
                  Updating...
                </div>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Update Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Account Statistics */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Statistics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {user?.id ? 'Active' : 'Inactive'}
            </div>
            <div className="text-sm text-gray-600">Account Status</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {user?.created_at ? 
                Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)) : 0
              }
            </div>
            <div className="text-sm text-gray-600">Days as Member</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {user?.email ? 'Verified' : 'Not Verified'}
            </div>
            <div className="text-sm text-gray-600">Email Status</div>
          </div>
        </div>
      </div>

      {/* Security Information */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Information</h2>
        
        <div className="space-y-4 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Your account is secured with JWT authentication</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Passwords are hashed using bcrypt</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>API credentials are encrypted and stored securely</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>All API communications use HTTPS</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 