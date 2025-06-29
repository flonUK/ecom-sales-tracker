import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  Calendar,
  DollarSign,
  TrendingUp,
  Filter
} from 'lucide-react';

const Analytics = () => {
  const [dateRange, setDateRange] = useState('30'); // days
  const [platform, setPlatform] = useState('');

  const { data: analytics, isLoading } = useQuery(
    ['analytics', dateRange, platform],
    async () => {
      const params = new URLSearchParams();
      if (dateRange) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(dateRange));
        params.append('start_date', startDate.toISOString());
        params.append('end_date', endDate.toISOString());
      }
      if (platform) {
        params.append('platform', platform);
      }

      const response = await axios.get(`/api/sales/analytics?${params}`);
      return response.data;
    }
  );

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

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
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="form-input"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="form-input"
            >
              <option value="">All Platforms</option>
              <option value="etsy">Etsy</option>
              <option value="ebay">eBay</option>
              <option value="amazon">Amazon</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${analytics?.summary?.totalRevenue?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-blue-100">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics?.summary?.totalSales || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-purple-100">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Average Order</p>
              <p className="text-2xl font-bold text-gray-900">
                ${analytics?.summary?.averageOrderValue?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-orange-100">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Period</p>
              <p className="text-2xl font-bold text-gray-900">
                ${analytics?.monthlyRevenue?.[0]?.revenue?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Platform */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Platform</h2>
          {analytics?.platformRevenue?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.platformRevenue}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ platform, revenue }) => `${platform}: $${revenue?.toFixed(2)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {analytics.platformRevenue.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${value?.toFixed(2)}`, 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No platform data available</p>
            </div>
          )}
        </div>

        {/* Monthly Revenue Trend */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
          {analytics?.monthlyRevenue?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value?.toFixed(2)}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No trend data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Selling Items */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Items</h2>
        {analytics?.topItems?.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={analytics.topItems}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="item_title" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value?.toFixed(2)}`, 'Revenue']} />
              <Bar dataKey="total_revenue" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No top items data available</p>
          </div>
        )}
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Breakdown */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Breakdown</h2>
          {analytics?.platformRevenue?.length > 0 ? (
            <div className="space-y-4">
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
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      ${platform.revenue?.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {((platform.revenue / analytics.summary.totalRevenue) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No platform data available</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {analytics?.recentActivity?.length > 0 ? (
            <div className="space-y-3">
              {analytics.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className={`badge badge-${activity.platform}`}>
                      {activity.platform}
                    </span>
                    <span className="text-sm text-gray-600">
                      {activity.new_sales} new sales
                    </span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    ${activity.new_revenue?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics; 