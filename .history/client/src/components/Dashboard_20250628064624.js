import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  Calendar,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

const Dashboard = () => {
  const { data: analytics, isLoading } = useQuery(
    ['analytics'],
    async () => {
      const response = await axios.get('/api/sales/analytics');
      return response.data;
    },
    {
      refetchInterval: 300000, // Refetch every 5 minutes
    }
  );

  const { data: recentSales } = useQuery(
    ['recent-sales'],
    async () => {
      const response = await axios.get('/api/sales?limit=5');
      return response.data;
    }
  );

  const { data: syncHistory } = useQuery(
    ['sync-history'],
    async () => {
      const response = await axios.get('/api/sales/sync-history?limit=5');
      return response.data;
    }
  );

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Revenue',
      value: `$${analytics?.summary?.totalRevenue?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Total Sales',
      value: analytics?.summary?.totalSales || 0,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Average Order',
      value: `$${analytics?.summary?.averageOrderValue?.toFixed(2) || '0.00'}`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'This Month',
      value: analytics?.monthlyRevenue?.[0]?.revenue?.toFixed(2) || '0.00',
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link to="/connections" className="btn btn-primary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Sync Data
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="card">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Sales</h2>
            <Link to="/sales" className="text-sm text-blue-600 hover:text-blue-500">
              View all
            </Link>
          </div>
          
          {recentSales?.sales?.length > 0 ? (
            <div className="space-y-3">
              {recentSales.sales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 truncate">{sale.item_title}</p>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span className={`badge badge-${sale.platform}`}>
                        {sale.platform}
                      </span>
                      <span>{format(new Date(sale.sale_date), 'MMM dd, yyyy')}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${sale.price}</p>
                    <p className="text-sm text-gray-600">Qty: {sale.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No recent sales</p>
          )}
        </div>

        {/* Platform Revenue */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Platform</h2>
          
          {analytics?.platformRevenue?.length > 0 ? (
            <div className="space-y-3">
              {analytics.platformRevenue.map((platform) => (
                <div key={platform.platform} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`badge badge-${platform.platform}`}>
                      {platform.platform}
                    </span>
                    <span className="text-sm text-gray-600">
                      {platform.sales_count} sales
                    </span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    ${platform.revenue?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No platform data available</p>
          )}
        </div>
      </div>

      {/* Sync History */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Sync Activity</h2>
        
        {syncHistory?.history?.length > 0 ? (
          <div className="space-y-3">
            {syncHistory.history.map((sync) => (
              <div key={sync.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className={`badge badge-${sync.platform}`}>
                    {sync.platform}
                  </span>
                  <span className="text-sm text-gray-600">
                    {sync.items_synced} items synced
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    {format(new Date(sync.sync_date), 'MMM dd, HH:mm')}
                  </p>
                  <p className={`text-xs ${
                    sync.status === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {sync.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No sync history available</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/connections" className="btn btn-outline">
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect Platforms
          </Link>
          <Link to="/sales" className="btn btn-outline">
            <ShoppingCart className="w-4 h-4 mr-2" />
            View All Sales
          </Link>
          <Link to="/analytics" className="btn btn-outline">
            <TrendingUp className="w-4 h-4 mr-2" />
            View Analytics
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 