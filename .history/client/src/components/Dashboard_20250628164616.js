import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const { token } = useContext(AuthContext);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
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
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedPlatform, token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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

  const getGrowthIndicator = (current, previous) => {
    if (!previous) return { value: 0, color: '#6b7280' };
    const growth = ((current - previous) / previous) * 100;
    return {
      value: growth,
      color: growth >= 0 ? '#10b981' : '#ef4444',
      icon: growth >= 0 ? '↗' : '↘'
    };
  };

  // Helper to check if all key arrays are empty or missing
  const isEmptyData = (data) => {
    return (
      !Array.isArray(data.platformBreakdown) || data.platformBreakdown.length === 0
    ) && (
      !Array.isArray(data.topProducts) || data.topProducts.length === 0
    ) && (
      !Array.isArray(data.recentActivity) || data.recentActivity.length === 0
    );
  };

  // Use mockData if backend data is empty
  const data = (!dashboardData || isEmptyData(dashboardData)) ? mockData : dashboardData;

  // Always use arrays, even if undefined from backend
  const platformBreakdown = data.platformBreakdown || [];
  const topProducts = data.topProducts || [];
  const recentActivity = data.recentActivity || [];

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

  // Mock data for demonstration (replace with real data when available)
  const mockData = {
    totalRevenue: 45680,
    totalSales: 342,
    totalItems: 456,
    avgOrderValue: 133.57,
    profitMargin: 28.5,
    adSpend: 12450,
    roas: 3.67,
    topProducts: [
      { name: 'Handmade Ceramic Mug', sales: 45, revenue: 2250, platform: 'etsy' },
      { name: 'Vintage Jewelry Box', sales: 38, revenue: 1900, platform: 'etsy' },
      { name: 'iPhone 13 Pro', sales: 32, revenue: 25600, platform: 'ebay' },
      { name: 'Kindle Paperwhite', sales: 28, revenue: 2240, platform: 'amazon' },
      { name: 'Custom T-Shirt', sales: 25, revenue: 750, platform: 'etsy' }
    ],
    platformBreakdown: [
      { platform: 'Etsy', revenue: 15680, sales: 156, margin: 35.2 },
      { platform: 'eBay', revenue: 22400, sales: 128, margin: 22.1 },
      { platform: 'Amazon', revenue: 7600, sales: 58, margin: 18.5 }
    ],
    recentActivity: [
      { platform: 'Etsy', item: 'Handmade Soap', revenue: 45, time: '2 hours ago' },
      { platform: 'eBay', item: 'Samsung Galaxy S21', revenue: 680, time: '4 hours ago' },
      { platform: 'Amazon', item: 'Echo Dot 4th Gen', revenue: 49, time: '6 hours ago' },
      { platform: 'Etsy', item: 'Crochet Blanket', revenue: 85, time: '8 hours ago' },
      { platform: 'eBay', item: 'MacBook Pro 14"', revenue: 1899, time: '12 hours ago' }
    ]
  };

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
            <option value="1y">Last year</option>
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
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <h3>Total Revenue</h3>
            <div className="metric-value">{formatCurrency(data.totalRevenue)}</div>
            <div className="metric-growth positive">
              <span>↗ +12.5%</span>
              <span className="growth-period">vs last period</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📦</div>
          <div className="metric-content">
            <h3>Total Sales</h3>
            <div className="metric-value">{formatNumber(data.totalSales)}</div>
            <div className="metric-growth positive">
              <span>↗ +8.2%</span>
              <span className="growth-period">vs last period</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <h3>Avg Order Value</h3>
            <div className="metric-value">{formatCurrency(data.avgOrderValue)}</div>
            <div className="metric-growth positive">
              <span>↗ +4.1%</span>
              <span className="growth-period">vs last period</span>
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
            <div className="metric-growth positive">
              <span>↗ +2.3%</span>
              <span className="growth-period">vs last period</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <h3>Ad Spend</h3>
            <div className="metric-value">{formatCurrency(data.adSpend)}</div>
            <div className="metric-growth negative">
              <span>↘ -5.2%</span>
              <span className="growth-period">vs last period</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔄</div>
          <div className="metric-content">
            <h3>ROAS</h3>
            <div className="metric-value">{data.roas}x</div>
            <div className="metric-growth positive">
              <span>↗ +18.7%</span>
              <span className="growth-period">vs last period</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Platform Performance */}
        <div className="dashboard-card platform-performance">
          <div className="card-header">
            <h2>Platform Performance</h2>
            <span className="card-subtitle">Revenue & profitability by platform</span>
          </div>
          <div className="platform-metrics">
            {platformBreakdown.map((platform, index) => (
              <div key={platform.platform} className="platform-metric">
                <div className="platform-info">
                  <div className="platform-icon">
                    {platform.platform === 'Etsy' ? '🛍️' : 
                     platform.platform === 'eBay' ? '📦' : '📚'}
                  </div>
                  <div className="platform-details">
                    <h4>{platform.platform}</h4>
                    <p>{formatNumber(platform.sales)} sales</p>
                  </div>
                </div>
                <div className="platform-stats">
                  <div className="platform-revenue">{formatCurrency(platform.revenue)}</div>
                  <div className="platform-margin" style={{ color: getProfitabilityColor(platform.margin) }}>
                    {platform.margin}% margin
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="dashboard-card top-products">
          <div className="card-header">
            <h2>Top Performing Products</h2>
            <span className="card-subtitle">Best sellers by revenue</span>
          </div>
          <div className="products-list">
            {topProducts.map((product, index) => (
              <div key={index} className="product-item">
                <div className="product-rank">#{index + 1}</div>
                <div className="product-info">
                  <h4>{product.name}</h4>
                  <div className="product-meta">
                    <span className="product-platform">{product.platform}</span>
                    <span className="product-sales">{product.sales} sold</span>
                  </div>
                </div>
                <div className="product-revenue">{formatCurrency(product.revenue)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-card recent-activity">
          <div className="card-header">
            <h2>Recent Sales Activity</h2>
            <span className="card-subtitle">Latest transactions</span>
          </div>
          <div className="activity-list">
            {recentActivity.map((activity, index) => (
              <div key={index} className="activity-item">
                <div className="activity-platform">
                  <span className={`platform-badge ${activity.platform.toLowerCase()}`}>
                    {activity.platform}
                  </span>
                </div>
                <div className="activity-details">
                  <h4>{activity.item}</h4>
                  <p>{activity.time}</p>
                </div>
                <div className="activity-revenue">{formatCurrency(activity.revenue)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Profitability Analysis */}
        <div className="dashboard-card profitability">
          <div className="card-header">
            <h2>Profitability Analysis</h2>
            <span className="card-subtitle">Revenue vs costs breakdown</span>
          </div>
          <div className="profitability-metrics">
            <div className="profit-metric">
              <div className="profit-label">Gross Revenue</div>
              <div className="profit-value">{formatCurrency(data.totalRevenue)}</div>
            </div>
            <div className="profit-metric">
              <div className="profit-label">Ad Spend</div>
              <div className="profit-value negative">{formatCurrency(data.adSpend)}</div>
            </div>
            <div className="profit-metric">
              <div className="profit-label">Other Costs</div>
              <div className="profit-value negative">{formatCurrency(data.totalRevenue * 0.15)}</div>
            </div>
            <div className="profit-metric total">
              <div className="profit-label">Net Profit</div>
              <div className="profit-value positive">
                {formatCurrency(data.totalRevenue - data.adSpend - (data.totalRevenue * 0.15))}
              </div>
            </div>
          </div>
          <div className="profit-chart">
            <div className="chart-bar">
              <div className="bar-label">Revenue</div>
              <div className="bar-container">
                <div className="bar-fill revenue" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div className="chart-bar">
              <div className="bar-label">Ad Spend</div>
              <div className="bar-container">
                <div className="bar-fill ad-spend" style={{ width: `${(data.adSpend / data.totalRevenue) * 100}%` }}></div>
              </div>
            </div>
            <div className="chart-bar">
              <div className="bar-label">Other Costs</div>
              <div className="bar-container">
                <div className="bar-fill costs" style={{ width: '15%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="action-btn primary">
          <span className="action-icon">📊</span>
          <span>View Detailed Analytics</span>
        </button>
        <button className="action-btn">
          <span className="action-icon">📤</span>
          <span>Export Report</span>
        </button>
        <button className="action-btn">
          <span className="action-icon">🔄</span>
          <span>Sync Data</span>
        </button>
        <button className="action-btn">
          <span className="action-icon">⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard; 