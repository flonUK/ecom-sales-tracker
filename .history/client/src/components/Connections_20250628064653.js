import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Download,
  Trash2
} from 'lucide-react';

const Connections = () => {
  const [isConnecting, setIsConnecting] = useState(null);
  const queryClient = useQueryClient();

  const { data: connections, isLoading } = useQuery(
    ['connections'],
    async () => {
      const [etsy, ebay, amazon] = await Promise.all([
        axios.get('/api/etsy/status'),
        axios.get('/api/ebay/status'),
        axios.get('/api/amazon/status')
      ]);
      
      return {
        etsy: etsy.data,
        ebay: ebay.data,
        amazon: amazon.data
      };
    }
  );

  const syncMutation = useMutation(
    async (platform) => {
      const response = await axios.get(`/api/${platform}/sales`);
      return response.data;
    },
    {
      onSuccess: (data, platform) => {
        toast.success(`${platform} data synced successfully! ${data.count} items imported.`);
        queryClient.invalidateQueries(['analytics']);
        queryClient.invalidateQueries(['recent-sales']);
        queryClient.invalidateQueries(['sync-history']);
      },
      onError: (error, platform) => {
        toast.error(`Failed to sync ${platform}: ${error.response?.data?.error || 'Unknown error'}`);
      }
    }
  );

  const disconnectMutation = useMutation(
    async (platform) => {
      await axios.delete(`/api/${platform}/disconnect`);
    },
    {
      onSuccess: (_, platform) => {
        toast.success(`${platform} disconnected successfully`);
        queryClient.invalidateQueries(['connections']);
      },
      onError: (error, platform) => {
        toast.error(`Failed to disconnect ${platform}: ${error.response?.data?.error || 'Unknown error'}`);
      }
    }
  );

  const platforms = [
    {
      id: 'etsy',
      name: 'Etsy',
      description: 'Connect your Etsy shop to import sales data',
      color: 'bg-orange-500',
      badgeClass: 'badge-etsy',
      icon: '🛍️'
    },
    {
      id: 'ebay',
      name: 'eBay',
      description: 'Connect your eBay account to import sales data',
      color: 'bg-green-500',
      badgeClass: 'badge-ebay',
      icon: '📦'
    },
    {
      id: 'amazon',
      name: 'Amazon',
      description: 'Connect your Amazon seller account to import sales data',
      color: 'bg-yellow-500',
      badgeClass: 'badge-amazon',
      icon: '📦'
    }
  ];

  const handleConnect = async (platform) => {
    setIsConnecting(platform);
    try {
      const response = await axios.get(`/api/${platform}/auth-url`);
      window.open(response.data.authUrl, '_blank', 'width=600,height=600');
      
      // Poll for connection status
      const checkConnection = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`/api/${platform}/status`);
          if (statusResponse.data.connected) {
            clearInterval(checkConnection);
            setIsConnecting(null);
            queryClient.invalidateQueries(['connections']);
            toast.success(`${platform} connected successfully!`);
          }
        } catch (error) {
          // Continue polling
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(checkConnection);
        setIsConnecting(null);
      }, 300000);
      
    } catch (error) {
      setIsConnecting(null);
      toast.error(`Failed to start ${platform} connection: ${error.response?.data?.error || 'Unknown error'}`);
    }
  };

  const handleSync = (platform) => {
    syncMutation.mutate(platform);
  };

  const handleDisconnect = (platform) => {
    if (window.confirm(`Are you sure you want to disconnect ${platform}?`)) {
      disconnectMutation.mutate(platform);
    }
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Platform Connections</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {platforms.map((platform) => {
          const isConnected = connections?.[platform.id]?.connected;
          const isConnectingPlatform = isConnecting === platform.id;
          const isSyncing = syncMutation.isLoading && syncMutation.variables === platform.id;
          const isDisconnecting = disconnectMutation.isLoading && disconnectMutation.variables === platform.id;

          return (
            <div key={platform.id} className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{platform.icon}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{platform.name}</h3>
                    <p className="text-sm text-gray-600">{platform.description}</p>
                  </div>
                </div>
                <span className={`badge ${platform.badgeClass}`}>
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              <div className="space-y-3">
                {isConnected ? (
                  <>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Last sync: {connections[platform.id].lastSync ? 
                        new Date(connections[platform.id].lastSync).toLocaleDateString() : 
                        'Never'
                      }</span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSync(platform.id)}
                        disabled={isSyncing}
                        className="btn btn-outline flex-1"
                      >
                        {isSyncing ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Sync Data
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleDisconnect(platform.id)}
                        disabled={isDisconnecting}
                        className="btn btn-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(platform.id)}
                    disabled={isConnectingPlatform}
                    className="btn btn-primary w-full"
                  >
                    {isConnectingPlatform ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Connect {platform.name}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection Instructions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection Instructions</h2>
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Etsy</h3>
            <p>You'll need to authorize this app to access your Etsy shop data. Make sure you have admin access to your Etsy shop.</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">eBay</h3>
            <p>You'll need to authorize this app to access your eBay seller account data. Make sure you have a seller account.</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Amazon</h3>
            <p>You'll need to authorize this app to access your Amazon Seller Central data. Make sure you have a seller account.</p>
          </div>
        </div>
      </div>

      {/* Sync History */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Sync Activity</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Date</th>
                <th>Items Synced</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {/* This would be populated with actual sync history data */}
              <tr>
                <td className="text-center text-gray-500" colSpan="4">
                  Sync history will appear here after your first sync
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Connections; 