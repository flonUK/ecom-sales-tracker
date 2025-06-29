import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Analytics.css';

const Analytics = () => {
  const { token } = useContext(AuthContext);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedPlatform, setSelectedPlatform] = useState('all');

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sales/analytics?days_back=${timeRange}&platform=${selectedPlatform}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      } else {
        console.error('Failed to fetch analytics data');
        setAnalyticsData({
          revenueTrend: [],
          salesTrend: [],
          platformBreakdown: [],
          topProducts: [],
          categoryBreakdown: [],
          customerMetrics: {
            newCustomers: 0,
            returningCustomers: 0,
            avgCustomerValue: 0
          }
        });
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setAnalyticsData({
        revenueTrend: [],
        salesTrend: [],
        platformBreakdown: [],
        topProducts: [],
        categoryBreakdown: [],
        customerMetrics: {
          newCustomers: 0,
          returningCustomers: 0,
          avgCustomerValue: 0
        }
      });
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedPlatform, token]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

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

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="analytics-loading">
          <div className="loading-spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  // Use actual data or empty state
  const data = analyticsData || {
    revenueTrend: [],
    salesTrend: [],
    platformBreakdown: [],
    topProducts: [],
    categoryBreakdown: [],
    customerMetrics: {
      newCustomers: 0,
      returningCustomers: 0,
      avgCustomerValue: 0
    }
  };

  // Always use arrays, even if undefined from backend
  const revenueTrend = data.revenueTrend || [];
  const salesTrend = data.salesTrend || [];
  const platformBreakdown = data.platformBreakdown || [];
  const topProducts = data.topProducts || [];
  const categoryBreakdown = data.categoryBreakdown || [];

  return (
    <div className="analytics-container">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-left">
          <h1>Analytics & Insights</h1>
          <p>Deep dive into your business performance</p>
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
        </div>
      </div>

      {/* Key Metrics */}
      <div className="analytics-metrics">
        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <h3>Revenue Trend</h3>
            <div className="metric-value">
              {revenueTrend.length > 0 ? 
                formatCurrency(revenueTrend.reduce((sum, item) => sum + (item.value || 0), 0)) : 
                formatCurrency(0)
              }
            </div>
            <div className="metric-period">
              Period: {timeRange === '7d' ? '7 days' : 
                       timeRange === '30d' ? '30 days' : 
                       timeRange === '90d' ? '90 days' : 
                       timeRange === '180d' ? '6 months' : 
                       timeRange === '1y' ? '1 year' : 
                       timeRange === 'ytd' ? 'Year to date' : '30 days'}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🛒</div>
          <div className="metric-content">
            <h3>Total Orders</h3>
            <div className="metric-value">
              {salesTrend.length > 0 ? 
                salesTrend.reduce((sum, item) => sum + (item.value || 0), 0) : 
                0
              }
            </div>
            <div className="metric-period">Orders in period</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <h3>New Customers</h3>
            <div className="metric-value">{formatNumber(data.customerMetrics.newCustomers)}</div>
            <div className="metric-period">Unique customers</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔄</div>
          <div className="metric-content">
            <h3>Repeat Rate</h3>
            <div className="metric-value">{data.customerMetrics.returningCustomers}</div>
            <div className="metric-period">Returning customers</div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-card">
          <div className="card-header">
            <h2>Revenue Trend</h2>
            <p className="card-subtitle">Daily revenue over time</p>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={(value) => `£${value}`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value) => [`£${value}`, 'Revenue']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="card-header">
            <h2>Sales Trend</h2>
            <p className="card-subtitle">Daily orders over time</p>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  stroke="#6b7280"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value) => [value, 'Orders']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="card-header">
            <h2>Platform Breakdown</h2>
            <p className="card-subtitle">Revenue distribution by platform</p>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={platformBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="platform" 
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={(value) => `£${value}`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value) => [`£${value}`, 'Revenue']}
                />
                <Bar 
                  dataKey="revenue" 
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="analytics-grid">
        {/* Top Products */}
        <div className="analytics-card">
          <div className="card-header">
            <div>
              <h2>Top Performing Products</h2>
              <p className="card-subtitle">Best sellers by revenue</p>
            </div>
          </div>
          <div className="products-chart">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div key={index} className="product-bar">
                  <div className="product-info">
                    <div className="product-rank">{index + 1}</div>
                    <div className="product-details">
                      <h4>{product.name}</h4>
                      <span className="product-platform">{product.platform}</span>
                    </div>
                  </div>
                  <div className="product-bar-container">
                    <div 
                      className="product-bar-fill"
                      style={{ 
                        width: `${(product.revenue / Math.max(...topProducts.map(p => p.revenue))) * 100}%`
                      }}
                    ></div>
                  </div>
                  <div className="product-value">{formatCurrency(product.revenue)}</div>
                </div>
              ))
            ) : (
              <div className="empty-chart">
                <p>No product data available. Connect your platforms to see top products.</p>
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="analytics-card">
          <div className="card-header">
            <div>
              <h2>Category Performance</h2>
              <p className="card-subtitle">Sales by product category</p>
            </div>
          </div>
          <div className="category-chart">
            {categoryBreakdown.length > 0 ? (
              categoryBreakdown.map((category, index) => (
                <div key={index} className="category-item">
                  <div className="category-info">
                    <div className="category-color" style={{ backgroundColor: category.color }}></div>
                    <span className="category-name">{category.name}</span>
                  </div>
                  <div className="category-stats">
                    <span className="category-revenue">{formatCurrency(category.revenue)}</span>
                    <span className="category-percentage">{category.percentage}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-chart">
                <p>No category data available. Connect your platforms to see category breakdown.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Insights */}
      <div className="analytics-card">
        <div className="card-header">
          <div>
            <h2>Customer Insights</h2>
            <p className="card-subtitle">Customer behavior and retention</p>
          </div>
        </div>
        
        <div className="customer-metrics">
          <div className="customer-metric">
            <div className="metric-header">
              <h3>New Customers</h3>
              <span className="metric-icon">🆕</span>
            </div>
            <div className="metric-value">{formatNumber(data.customerMetrics.newCustomers)}</div>
            <div className="metric-change positive">+12% vs last period</div>
          </div>

          <div className="customer-metric">
            <div className="metric-header">
              <h3>Returning Customers</h3>
              <span className="metric-icon">🔄</span>
            </div>
            <div className="metric-value">{formatNumber(data.customerMetrics.returningCustomers)}</div>
            <div className="metric-change positive">+8% vs last period</div>
          </div>

          <div className="customer-metric">
            <div className="metric-header">
              <h3>Avg Customer Value</h3>
              <span className="metric-icon">💰</span>
            </div>
            <div className="metric-value">{formatCurrency(data.customerMetrics.avgCustomerValue)}</div>
            <div className="metric-change positive">+5% vs last period</div>
          </div>

          <div className="customer-metric">
            <div className="metric-header">
              <h3>Customer Lifetime Value</h3>
              <span className="metric-icon">🎯</span>
            </div>
            <div className="metric-value">{formatCurrency(data.customerMetrics.avgCustomerValue * 3.2)}</div>
            <div className="metric-change positive">+15% vs last period</div>
          </div>
        </div>
      </div>

      {/* Sales Trend */}
      <div className="analytics-card">
        <div className="card-header">
          <div>
            <h2>Sales Volume Trend</h2>
            <p className="card-subtitle">Number of orders over time</p>
          </div>
        </div>
        <div className="chart-container">
          {salesTrend.length > 0 ? (
            <div className="sales-trend-chart">
              {salesTrend.map((point, index) => (
                <div key={index} className="trend-point">
                  <div className="point-label">{point.date}</div>
                  <div className="point-value">{point.value}</div>
                  <div 
                    className="point-marker"
                    style={{ 
                      height: `${(point.value / Math.max(...salesTrend.map(p => p.value))) * 100}%`
                    }}
                  ></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-chart">
              <p>No sales trend data available for the selected period.</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="analytics-actions">
        <button className="action-btn primary">
          <span className="action-icon">📊</span>
          Generate Report
        </button>
        <button className="action-btn">
          <span className="action-icon">📤</span>
          Export Data
        </button>
        <button className="action-btn">
          <span className="action-icon">🔗</span>
          Connect More Platforms
        </button>
        <button className="action-btn">
          <span className="action-icon">⚙️</span>
          Analytics Settings
        </button>
      </div>
    </div>
  );
};

export default Analytics; 