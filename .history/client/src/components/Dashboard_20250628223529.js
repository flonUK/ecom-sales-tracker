import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

const Dashboard = () => {
  const { token } = useContext(AuthContext);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedPlatform, setSelectedPlatform] = useState('all');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sales/stats?days_back=${timeRange}&platform=${selectedPlatform}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Transform backend data to frontend format
        const transformedData = {
          totalRevenue: data.stats?.total_revenue || 0,
          totalSales: data.stats?.total_sales || 0,
          totalItems: data.stats?.total_sales || 0, // Using sales count as items
          avgOrderValue: data.stats?.avg_order_value || 0,
          profitMargin: 25, // Default estimated margin
          adSpend: 0, // Not tracked yet
          roas: 0, // Not tracked yet
          topProducts: [], // Not implemented yet
          platformBreakdown: data.platform_data?.map(p => ({
            platform: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
            sales: p.sales,
            revenue: p.revenue,
            margin: 25 // Default estimated margin
          })) || [],
          recentActivity: [] // Not implemented yet
        };
        setDashboardData(transformedData);
      } else {
        console.error('Failed to fetch dashboard data');
        setDashboardData({
          totalRevenue: 0,
          totalSales: 0,
          totalItems: 0,
          avgOrderValue: 0,
          profitMargin: 0,
          adSpend: 0,
          roas: 0,
          topProducts: [],
          platformBreakdown: [],
          recentActivity: []
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setDashboardData({
        totalRevenue: 0,
        totalSales: 0,
        totalItems: 0,
        avgOrderValue: 0,
        profitMargin: 0,
        adSpend: 0,
        roas: 0,
        topProducts: [],
        platformBreakdown: [],
        recentActivity: []
      });
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedPlatform, token]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/sales/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ days_back: 30 })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Sync completed:', result);
        // Refresh dashboard data after sync
        await fetchDashboardData();
      } else {
        console.error('Sync failed');
      }
    } catch (error) {
      console.error('Error during sync:', error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // GBP currency formatting
  const formatCurrency = (amount) => {
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(safeAmount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getProfitabilityColor = (margin) => {
    if (margin >= 30) return '#10b981'; // Green
    if (margin >= 15) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading business metrics...</p>
        </div>
      </div>
    );
  }

  // Use actual data or empty state
  const data = dashboardData || {
    totalRevenue: 0,
    totalSales: 0,
    totalItems: 0,
    avgOrderValue: 0,
    profitMargin: 0,
    adSpend: 0,
    roas: 0,
    topProducts: [],
    platformBreakdown: [],
    recentActivity: []
  };

  // Always use arrays, even if undefined from backend
  const platformBreakdown = data.platformBreakdown || [];
  const topProducts = data.topProducts || [];
  const recentActivity = data.recentActivity || [];

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Business Dashboard</h1>
          <p>Multi-platform e-commerce performance overview</p>
        </div>
        <div className="header-controls">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-select"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="180d">Last 6 months</option>
            <option value="1y">Last year</option>
            <option value="ytd">Year to date</option>
          </select>
          <select 
            value={selectedPlatform} 
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="platform-select"
          >
            <option value="all">All Platforms</option>
            <option value="etsy">Etsy</option>
            <option value="ebay">eBay</option>
            <option value="amazon">Amazon</option>
            <option value="swell">Swell</option>
          </select>
          <button 
            onClick={handleSync} 
            disabled={syncing}
            className="sync-button"
          >
            {syncing ? '🔄 Syncing...' : '🔄 Sync Data'}
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <h3>Total Revenue</h3>
            <div className="metric-value">{formatCurrency(data.totalRevenue)}</div>
            <div className="metric-period">
              <span>Period: {timeRange === '7d' ? '7 days' : 
                           timeRange === '30d' ? '30 days' : 
                           timeRange === '90d' ? '90 days' : 
                           timeRange === '180d' ? '6 months' : 
                           timeRange === '1y' ? '1 year' : 
                           timeRange === 'ytd' ? 'Year to date' : '30 days'}</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📦</div>
          <div className="metric-content">
            <h3>Total Sales</h3>
            <div className="metric-value">{formatNumber(data.totalSales)}</div>
            <div className="metric-period">
              <span>Orders in period</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <h3>Avg Order Value</h3>
            <div className="metric-value">{formatCurrency(data.avgOrderValue)}</div>
            <div className="metric-period">
              <span>Average per order</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎯</div>
          <div className="metric-content">
            <h3>Profit Margin</h3>
            <div className="metric-value" style={{ color: getProfitabilityColor(data.profitMargin) }}>
              {data.profitMargin}%
            </div>
            <div className="metric-period">
              <span>Estimated margin</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <h3>Ad Spend</h3>
            <div className="metric-value">{formatCurrency(data.adSpend)}</div>
            <div className="metric-period">
              <span>Marketing budget</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔄</div>
          <div className="metric-content">
            <h3>ROAS</h3>
            <div className="metric-value">{data.roas}x</div>
            <div className="metric-period">
              <span>Return on ad spend</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Platform Performance */}
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Platform Performance</h2>
              <p className="card-subtitle">Revenue breakdown by platform</p>
            </div>
          </div>
          <div className="platform-metrics">
            {platformBreakdown.length > 0 ? (
              platformBreakdown.map((platform, index) => (
                <div key={index} className="platform-metric">
                  <div className="platform-info">
                    <div className={`platform-icon ${platform.platform.toLowerCase()}`}>
                      {platform.platform === 'Etsy' ? '🛍️' : 
                       platform.platform === 'eBay' ? '📦' : 
                       platform.platform === 'Amazon' ? '📚' :
                       platform.platform === 'Swell' ? '🛒' : '📊'}
                    </div>
                    <div className="platform-details">
                      <h4>{platform.platform}</h4>
                      <p>{platform.sales} orders</p>
                    </div>
                  </div>
                  <div className="platform-stats">
                    <div className="platform-revenue">{formatCurrency(platform.revenue)}</div>
                    <div className="platform-margin">{platform.margin}% margin</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No platform data available. Connect your platforms to see performance metrics.</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Top Products</h2>
              <p className="card-subtitle">Best performing products</p>
            </div>
          </div>
          <div className="products-list">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div key={index} className="product-item">
                  <div className="product-rank">{index + 1}</div>
                  <div className="product-info">
                    <h4>{product.name}</h4>
                    <div className="product-meta">
                      <span className="product-platform">{product.platform}</span>
                      <span>•</span>
                      <span>{product.sales} sales</span>
                    </div>
                  </div>
                  <div className="product-revenue">{formatCurrency(product.revenue)}</div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No product data available. Connect your platforms to see top products.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Recent Activity</h2>
              <p className="card-subtitle">Latest sales and orders</p>
            </div>
          </div>
          <div className="activity-list">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-platform">
                    <span className={`platform-badge ${activity.platform}`}>
                      {activity.platform === 'etsy' ? '🛍️' : 
                       activity.platform === 'ebay' ? '📦' : 
                       activity.platform === 'amazon' ? '📚' :
                       activity.platform === 'swell' ? '🛒' : '📊'}
                    </span>
                  </div>
                  <div className="activity-details">
                    <h4>{activity.item}</h4>
                    <p>{activity.time}</p>
                  </div>
                  <div className="activity-revenue">{formatCurrency(activity.revenue)}</div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No recent activity. Connect your platforms to see live updates.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profitability Analysis */}
      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h2>Profitability Analysis</h2>
            <p className="card-subtitle">Revenue vs costs breakdown</p>
          </div>
        </div>
        
        <div className="profitability-metrics">
          <div className="profit-metric total">
            <div className="profit-label">Total Revenue</div>
            <div className="profit-value positive">{formatCurrency(data.totalRevenue)}</div>
          </div>
          <div className="profit-metric">
            <div className="profit-label">Ad Spend</div>
            <div className="profit-value negative">{formatCurrency(data.adSpend)}</div>
          </div>
          <div className="profit-metric">
            <div className="profit-label">Other Costs</div>
            <div className="profit-value negative">{formatCurrency(data.totalRevenue * 0.15)}</div>
          </div>
        </div>

        <div className="profit-chart">
          <div className="chart-bar">
            <div className="bar-label">
              <span>Revenue</span>
              <span>{formatCurrency(data.totalRevenue)}</span>
            </div>
            <div className="bar-container">
              <div 
                className="bar-fill revenue" 
                style={{ width: '100%' }}
              ></div>
            </div>
          </div>
          <div className="chart-bar">
            <div className="bar-label">
              <span>Ad Spend</span>
              <span>{formatCurrency(data.adSpend)}</span>
            </div>
            <div className="bar-container">
              <div 
                className="bar-fill ad-spend" 
                style={{ width: `${(data.adSpend / data.totalRevenue) * 100}%` }}
              ></div>
            </div>
          </div>
          <div className="chart-bar">
            <div className="bar-label">
              <span>Other Costs</span>
              <span>{formatCurrency(data.totalRevenue * 0.15)}</span>
            </div>
            <div className="bar-container">
              <div 
                className="bar-fill costs" 
                style={{ width: '15%' }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="action-btn primary">
          <span className="action-icon">📊</span>
          View Detailed Analytics
        </button>
        <button className="action-btn">
          <span className="action-icon">📦</span>
          Export Sales Data
        </button>
        <button className="action-btn">
          <span className="action-icon">🔗</span>
          Manage Connections
        </button>
        <button className="action-btn">
          <span className="action-icon">⚙️</span>
          Settings
        </button>
      </div>
    </div>
  );
};

export default Dashboard; 