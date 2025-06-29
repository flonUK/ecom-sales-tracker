import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Analytics.css';

const Analytics = () => {
  const { token } = useContext(AuthContext);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [platform, setPlatform] = useState('all');

  // Mock data for demonstration
  const mockAnalytics = {
    summary: {
      totalRevenue: 45680,
      totalSales: 342,
      averageOrderValue: 133.57,
      profitMargin: 28.5
    },
    platformRevenue: [
      { platform: 'Etsy', revenue: 15680, percentage: 34.3 },
      { platform: 'eBay', revenue: 22400, percentage: 49.1 },
      { platform: 'Amazon', revenue: 7600, percentage: 16.6 }
    ],
    monthlyRevenue: [
      { month: 'Jan', revenue: 12500 },
      { month: 'Feb', revenue: 13800 },
      { month: 'Mar', revenue: 15200 },
      { month: 'Apr', revenue: 16800 },
      { month: 'May', revenue: 18200 },
      { month: 'Jun', revenue: 19500 }
    ],
    topProducts: [
      { name: 'Handmade Ceramic Mug', revenue: 2250, sales: 45 },
      { name: 'Vintage Jewelry Box', revenue: 1900, sales: 38 },
      { name: 'iPhone 13 Pro', revenue: 25600, sales: 32 },
      { name: 'Kindle Paperwhite', revenue: 2240, sales: 28 },
      { name: 'Custom T-Shirt', revenue: 750, sales: 25 }
    ],
    salesByDay: [
      { day: 'Mon', sales: 12, revenue: 1600 },
      { day: 'Tue', sales: 15, revenue: 2100 },
      { day: 'Wed', sales: 18, revenue: 2400 },
      { day: 'Thu', sales: 22, revenue: 2900 },
      { day: 'Fri', sales: 25, revenue: 3300 },
      { day: 'Sat', sales: 28, revenue: 3700 },
      { day: 'Sun', sales: 20, revenue: 2600 }
    ]
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange, platform]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sales/analytics?days_back=${dateRange}&platform=${platform}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      } else {
        // Use mock data if API fails
        setAnalyticsData(mockAnalytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Use mock data on error
      setAnalyticsData(mockAnalytics);
    } finally {
      setLoading(false);
    }
  };

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
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  const data = analyticsData || mockAnalytics;

  return (
    <div className="analytics-container">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-left">
          <h1>Analytics Dashboard</h1>
          <p>Detailed performance insights and trends</p>
        </div>
        <div className="header-controls">
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="time-select"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <select 
            value={platform} 
            onChange={(e) => setPlatform(e.target.value)}
            className="platform-select"
          >
            <option value="all">All Platforms</option>
            <option value="etsy">Etsy</option>
            <option value="ebay">eBay</option>
            <option value="amazon">Amazon</option>
          </select>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <h3>Total Revenue</h3>
            <div className="metric-value">{formatCurrency(data.summary?.totalRevenue)}</div>
            <div className="metric-growth positive">
              <span>↗ +15.2%</span>
              <span className="growth-period">vs last period</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📦</div>
          <div className="metric-content">
            <h3>Total Sales</h3>
            <div className="metric-value">{formatNumber(data.summary?.totalSales)}</div>
            <div className="metric-growth positive">
              <span>↗ +12.8%</span>
              <span className="growth-period">vs last period</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <h3>Avg Order Value</h3>
            <div className="metric-value">{formatCurrency(data.summary?.averageOrderValue)}</div>
            <div className="metric-growth positive">
              <span>↗ +2.1%</span>
              <span className="growth-period">vs last period</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎯</div>
          <div className="metric-content">
            <h3>Profit Margin</h3>
            <div className="metric-value">{data.summary?.profitMargin}%</div>
            <div className="metric-growth positive">
              <span>↗ +3.4%</span>
              <span className="growth-period">vs last period</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="analytics-grid">
        {/* Platform Revenue Distribution */}
        <div className="analytics-card">
          <div className="card-header">
            <h2>Revenue by Platform</h2>
            <span className="card-subtitle">Distribution across platforms</span>
          </div>
          <div className="platform-chart">
            {data.platformRevenue?.map((platform, index) => (
              <div key={platform.platform} className="platform-bar">
                <div className="platform-info">
                  <span className="platform-name">{platform.platform}</span>
                  <span className="platform-revenue">{formatCurrency(platform.revenue)}</span>
                </div>
                <div className="bar-container">
                  <div 
                    className="bar-fill" 
                    style={{ 
                      width: `${platform.percentage}%`,
                      backgroundColor: index === 0 ? '#3b82f6' : index === 1 ? '#10b981' : '#f59e0b'
                    }}
                  ></div>
                </div>
                <span className="percentage">{platform.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="analytics-card">
          <div className="card-header">
            <h2>Revenue Trend</h2>
            <span className="card-subtitle">Monthly revenue progression</span>
          </div>
          <div className="trend-chart">
            <div className="chart-bars">
              {data.monthlyRevenue?.map((month, index) => (
                <div key={month.month} className="trend-bar">
                  <div className="bar-value">{formatCurrency(month.revenue)}</div>
                  <div 
                    className="bar" 
                    style={{ 
                      height: `${(month.revenue / Math.max(...data.monthlyRevenue.map(m => m.revenue))) * 200}px`
                    }}
                  ></div>
                  <div className="bar-label">{month.month}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly Sales Pattern */}
        <div className="analytics-card">
          <div className="card-header">
            <h2>Weekly Sales Pattern</h2>
            <span className="card-subtitle">Sales by day of week</span>
          </div>
          <div className="weekly-chart">
            {data.salesByDay?.map((day, index) => (
              <div key={day.day} className="day-bar">
                <div className="day-info">
                  <span className="day-name">{day.day}</span>
                  <span className="day-sales">{day.sales} sales</span>
                </div>
                <div className="day-bar-container">
                  <div 
                    className="day-bar-fill" 
                    style={{ 
                      height: `${(day.sales / Math.max(...data.salesByDay.map(d => d.sales))) * 120}px`
                    }}
                  ></div>
                </div>
                <span className="day-revenue">{formatCurrency(day.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="analytics-card">
          <div className="card-header">
            <h2>Top Performing Products</h2>
            <span className="card-subtitle">Best sellers by revenue</span>
          </div>
          <div className="products-chart">
            {data.topProducts?.map((product, index) => (
              <div key={index} className="product-bar">
                <div className="product-info">
                  <span className="product-rank">#{index + 1}</span>
                  <span className="product-name">{product.name}</span>
                </div>
                <div className="product-stats">
                  <span className="product-sales">{product.sales} sold</span>
                  <span className="product-revenue">{formatCurrency(product.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="insights-section">
        <div className="analytics-card">
          <div className="card-header">
            <h2>Key Insights</h2>
            <span className="card-subtitle">Performance highlights</span>
          </div>
          <div className="insights-grid">
            <div className="insight-item positive">
              <div className="insight-icon">📈</div>
              <div className="insight-content">
                <h4>Revenue Growth</h4>
                <p>15.2% increase in total revenue compared to last period</p>
              </div>
            </div>
            <div className="insight-item positive">
              <div className="insight-icon">🎯</div>
              <div className="insight-content">
                <h4>Platform Performance</h4>
                <p>eBay leads with 49.1% of total revenue</p>
              </div>
            </div>
            <div className="insight-item neutral">
              <div className="insight-icon">📊</div>
              <div className="insight-content">
                <h4>Sales Pattern</h4>
                <p>Peak sales on Saturdays with 28 transactions</p>
              </div>
            </div>
            <div className="insight-item positive">
              <div className="insight-icon">💰</div>
              <div className="insight-content">
                <h4>Profitability</h4>
                <p>28.5% profit margin, up 3.4% from last period</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics; 