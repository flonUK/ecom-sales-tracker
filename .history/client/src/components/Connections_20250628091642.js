import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Download,
  Trash2,
  Plus
} from 'lucide-react';

const Connections = () => {
  const [isConnecting, setIsConnecting] = useState(null);
  const [showEtsyModal, setShowEtsyModal] = useState(false);
  const [etsyShopUrl, setEtsyShopUrl] = useState('');
  const queryClient = useQueryClient();

  const { data: connections, isLoading } = useQuery(
    ['connections'],
    async () => {
      const [etsy, ebay, amazon] = await Promise.all([
        axios.get('/api/etsy/shops').catch(() => ({ data: { shops: [] } })),
        axios.get('/api/ebay/status').catch(() => ({ data: { connected: false } })),
        axios.get('/api/amazon/status').catch(() => ({ data: { connected: false } }))
      ]);
      
      return {
        etsy: { connected: etsy.data.shops.length > 0, shops: etsy.data.shops },
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
        toast.success(`${platform} data synced successfully! ${data.total || data.count} items imported.`);
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
    async ({ platform, shopId }) => {
      if (platform === 'etsy' && shopId) {
        await axios.delete(`/api/${platform}/disconnect/${shopId}`);
      } else {
        await axios.delete(`/api/${platform}/disconnect`);
      }
    },
    {
      onSuccess: (_, { platform }) => {
        toast.success(`${platform} disconnected successfully`);
        queryClient.invalidateQueries(['connections']);
      },
      onError: (error, { platform }) => {
        toast.error(`Failed to disconnect ${platform}: ${error.response?.data?.error || 'Unknown error'}`);
      }
    }
  );

  const connectEtsyMutation = useMutation(
    async (shopUrl) => {
      const response = await axios.post('/api/etsy/connect', { shopUrl });
      return response.data;
    },
    {
      onSuccess: (data) => {
        toast.success(`Etsy shop "${data.shop.name}" connected successfully!`);
        setShowEtsyModal(false);
        setEtsyShopUrl('');
        queryClient.invalidateQueries(['connections']);
      },
      onError: (error) => {
        toast.error(`Failed to connect Etsy shop: ${error.response?.data?.error || 'Unknown error'}`);
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
    if (platform === 'etsy') {
      setShowEtsyModal(true);
      return;
    }

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

  const handleDisconnect = (platform, shopId = null) => {
    const message = shopId ? 
      `Are you sure you want to disconnect this Etsy shop?` : 
      `Are you sure you want to disconnect ${platform}?`;
    
    if (window.confirm(message)) {
      disconnectMutation.mutate({ platform, shopId });
    }
  };

  const handleConnectEtsy = () => {
    if (!etsyShopUrl.trim()) {
      toast.error('Please enter your Etsy shop URL');
      return;
    }
    connectEtsyMutation.mutate(etsyShopUrl.trim());
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
          const isDisconnecting = disconnectMutation.isLoading && disconnectMutation.variables?.platform === platform.id;

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

              {/* Show connected Etsy shops */}
              {platform.id === 'etsy' && isConnected && connections.etsy.shops && (
                <div className="mb-4 space-y-2">
                  {connections.etsy.shops.map((shop) => (
                    <div key={shop.store_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{shop.store_name}</p>
                        <p className="text-xs text-gray-500">{shop.store_url}</p>
                      </div>
                      <button
                        onClick={() => handleDisconnect('etsy', shop.store_id)}
                        disabled={isDisconnecting}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Disconnect shop"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {isConnected ? (
                  <>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Connected</span>
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
                        {isDisconnecting ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
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
                        <Plus className="w-4 h-4 mr-2" />
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

      {/* Etsy Connection Modal */}
      {showEtsyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Connect Etsy Shop</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter your Etsy shop URL to connect. For example: https://www.etsy.com/shop/your-shop-name
            </p>
            
            <input
              type="url"
              value={etsyShopUrl}
              onChange={(e) => setEtsyShopUrl(e.target.value)}
              placeholder="https://www.etsy.com/shop/your-shop-name"
              className="w-full p-2 border border-gray-300 rounded mb-4"
            />
            
            <div className="flex space-x-2">
              <button
                onClick={handleConnectEtsy}
                disabled={connectEtsyMutation.isLoading}
                className="btn btn-primary flex-1"
              >
                {connectEtsyMutation.isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Shop'
                )}
              </button>
              
              <button
                onClick={() => {
                  setShowEtsyModal(false);
                  setEtsyShopUrl('');
                }}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Connections; 