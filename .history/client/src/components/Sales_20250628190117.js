import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Sales.css';

const Sales = () => {
  const { token } = useContext(AuthContext);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    platform: 'all',
    dateRange: '30d',
    status: 'all'
  });

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        platform: filters.platform,
        days_back: filters.dateRange,
        status: filters.status
      });

      const response = await fetch(`/api/sales?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Handle both array and object responses
        const salesData = Array.isArray(data) ? data : (data.sales || []);
        setSales(salesData);
      } else {
        console.error('Failed to fetch sales data');
        setSales([]);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const formatCurrency = (amount) => {
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(safeAmount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getPlatformIcon = (platform) => {
    switch (platform.toLowerCase()) {
      case 'etsy': return '🛍️';
      case 'ebay': return '📦';
      case 'amazon': return '📚';
      case 'swell': return '🛒';
      default: return '📊';
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'completed': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      case 'refunded': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const exportSales = () => {
    if (!Array.isArray(sales) || sales.length === 0) {
      alert('No sales data to export');
      return;
    }
    
    const csvContent = [
      ['Date', 'Platform', 'Item', 'Order ID', 'Revenue', 'Status'],
      ...sales.map(sale => [
        formatDate(sale.sale_date),
        sale.platform,
        sale.item_title,
        sale.order_id,
        sale.price * sale.quantity,
        sale.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const syncData = () => {
    // Implementation of syncData function
  };

  if (loading) {
    return (
      <div className="sales-container">
        <div className="sales-loading">
          <div className="loading-spinner"></div>
          <p>Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-header">
        <div className="header-left">
          <h1>Sales Overview</h1>
          <p>Track and manage your multi-platform sales</p>
        </div>
        <div className="header-actions">
          <button className="sync-btn" onClick={syncData}>
            <span className="btn-icon">🔄</span>
            Sync Data
          </button>
          <button className="export-btn" onClick={exportSales}>
            <span className="btn-icon">📤</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="sales-filters">
        <div className="filter-group">
          <label>Platform</label>
          <select 
            value={filters.platform} 
            onChange={(e) => handleFilterChange('platform', e.target.value)}
            className="filter-select"
          >
            <option value="all">All Platforms</option>
            <option value="etsy">Etsy</option>
            <option value="ebay">eBay</option>
            <option value="amazon">Amazon</option>
            <option value="swell">Swell</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Date Range</label>
          <select 
            value={filters.dateRange} 
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="filter-select"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status</label>
          <select 
            value={filters.status} 
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Sales Summary */}
      <div className="sales-summary">
        <div className="summary-card">
          <div className="summary-icon">💰</div>
          <div className="summary-content">
            <h3>Total Revenue</h3>
            <div className="summary-value">
              {formatCurrency(Array.isArray(sales) ? sales.reduce((sum, sale) => sum + (sale.price * sale.quantity || 0), 0) : 0)}
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">📦</div>
          <div className="summary-content">
            <h3>Total Orders</h3>
            <div className="summary-value">{Array.isArray(sales) ? sales.length : 0}</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">📊</div>
          <div className="summary-content">
            <h3>Avg Order Value</h3>
            <div className="summary-value">
              {Array.isArray(sales) && sales.length > 0 
                ? formatCurrency(sales.reduce((sum, sale) => sum + (sale.price * sale.quantity || 0), 0) / sales.length)
                : formatCurrency(0)
              }
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">✅</div>
          <div className="summary-content">
            <h3>Completed Orders</h3>
            <div className="summary-value">
              {Array.isArray(sales) ? sales.filter(sale => sale.status?.toLowerCase() === 'completed').length : 0}
            </div>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="sales-table-container">
        <div className="table-header">
          <h2>Sales Details</h2>
          <div className="table-actions">
            <span className="results-count">
              {Array.isArray(sales) ? sales.length : 0} {Array.isArray(sales) && sales.length === 1 ? 'sale' : 'sales'} found
            </span>
          </div>
        </div>

        {Array.isArray(sales) && sales.length > 0 ? (
          <div className="sales-table">
            <div className="table-header-row">
              <div className="table-cell header">Date</div>
              <div className="table-cell header">Platform</div>
              <div className="table-cell header">Item</div>
              <div className="table-cell header">Order ID</div>
              <div className="table-cell header">Revenue</div>
              <div className="table-cell header">Status</div>
            </div>

            {sales.map((sale, index) => (
              <div key={index} className="table-row">
                <div className="table-cell">
                  <div className="date-info">
                    <span className="date">{formatDate(sale.sale_date)}</span>
                  </div>
                </div>
                
                <div className="table-cell">
                  <div className="platform-info">
                    <span className="platform-icon">
                      {getPlatformIcon(sale.platform)}
                    </span>
                    <span className="platform-name">{sale.platform}</span>
                  </div>
                </div>
                
                <div className="table-cell">
                  <div className="item-info">
                    <h4>{sale.item_title}</h4>
                    {sale.sku && <span className="sku">SKU: {sale.sku}</span>}
                  </div>
                </div>
                
                <div className="table-cell">
                  <div className="order-id">{sale.order_id}</div>
                </div>
                
                <div className="table-cell">
                  <div className="revenue">{formatCurrency(sale.price * sale.quantity)}</div>
                </div>
                
                <div className="table-cell">
                  <div 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(sale.status) }}
                  >
                    {sale.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No sales data available</h3>
            <p>Connect your platforms to start tracking your sales performance.</p>
            <button className="connect-btn">
              <span className="btn-icon">🔗</span>
              Connect Platforms
            </button>
          </div>
        )}
      </div>

      {/* Platform Breakdown */}
      {Array.isArray(sales) && sales.length > 0 && (
        <div className="platform-breakdown">
          <h2>Platform Performance</h2>
          <div className="platform-cards">
            {['etsy', 'ebay', 'amazon', 'swell'].map(platform => {
              const platformSales = sales.filter(sale => 
                sale.platform?.toLowerCase() === platform
              );
              const platformRevenue = platformSales.reduce((sum, sale) => 
                sum + (sale.price * sale.quantity || 0), 0
              );
              
              if (platformSales.length === 0) return null;

              return (
                <div key={platform} className="platform-card">
                  <div className="platform-header">
                    <span className="platform-icon">{getPlatformIcon(platform)}</span>
                    <h3>{platform.charAt(0).toUpperCase() + platform.slice(1)}</h3>
                  </div>
                  <div className="platform-stats">
                    <div className="stat">
                      <span className="stat-label">Orders</span>
                      <span className="stat-value">{platformSales.length}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Revenue</span>
                      <span className="stat-value">{formatCurrency(platformRevenue)}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Avg Order</span>
                      <span className="stat-value">
                        {formatCurrency(platformRevenue / platformSales.length)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales; 