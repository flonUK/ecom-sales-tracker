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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  // Sorting state
  const [sortConfig, setSortConfig] = useState({
    key: 'sale_date',
    direction: 'desc'
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
        const salesData = Array.isArray(data) ? data : (data.sales || []);
        setSales(salesData);
        setCurrentPage(1); // Reset to first page when filters change
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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
    switch (platform?.toLowerCase()) {
      case 'etsy': return '🛍️';
      case 'ebay': return '📦';
      case 'amazon': return '📚';
      case 'swell': return '🛒';
      default: return '📊';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'complete': return '#10b981';
      case 'pending':
      case 'delivery_pending': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      case 'refunded': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Normalize status for filtering and display
  const normalizeStatus = (status) => {
    if (!status) return 'unknown';
    const lowerStatus = status.toLowerCase();
    
    // Map Swell statuses to standard statuses
    if (lowerStatus === 'complete') return 'completed';
    if (lowerStatus === 'delivery_pending') return 'pending';
    
    return lowerStatus;
  };

  // Get unique statuses from sales data for filter options
  const getUniqueStatuses = () => {
    // Use normalized_status from backend if available, otherwise calculate locally
    const statuses = [...new Set(sales.map(sale => sale.normalized_status || normalizeStatus(sale.status)))];
    return statuses.sort();
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Sorting function
  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Sort sales data
  const sortSales = (salesData) => {
    return [...salesData].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle date sorting
      if (sortConfig.key === 'sale_date') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      // Handle numeric sorting
      if (sortConfig.key === 'price' || sortConfig.key === 'quantity') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }

      // Handle string sorting
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  // Filter and search sales
  const filteredSales = sales.filter(sale => {
    const matchesSearch = searchTerm === '' || 
      sale.item_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.platform?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Apply status filter using normalized status
    const saleStatus = sale.normalized_status || normalizeStatus(sale.status);
    const matchesStatus = filters.status === 'all' || saleStatus === filters.status;
    
    return matchesSearch && matchesStatus;
  });

  // Sort filtered sales
  const sortedSales = sortSales(filteredSales);

  // Pagination calculations
  const totalItems = sortedSales.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentSales = sortedSales.slice(startIndex, endIndex);

  // Page size options
  const pageSizeOptions = [10, 25, 50, 100];

  const exportSales = () => {
    if (!Array.isArray(sales) || sales.length === 0) {
      alert('No sales data to export');
      return;
    }
    
    const csvContent = [
      ['Date', 'Platform', 'Item', 'Order ID', 'Quantity', 'Price', 'Revenue', 'Status'],
      ...sales.map(sale => [
        formatDate(sale.sale_date),
        sale.platform,
        sale.item_title,
        sale.order_id,
        sale.quantity || 1,
        formatCurrency(sale.price),
        formatCurrency(sale.price * (sale.quantity || 1)),
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

  const syncData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/sales/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        await fetchSales();
        alert('Data sync completed!');
      } else {
        alert('Error syncing data. Please try again.');
      }
    } catch (error) {
      console.error('Error syncing data:', error);
      alert('Error syncing data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page
  };

  // Get sort indicator
  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
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

      {/* Sales Summary */}
      <div className="sales-summary">
        <div className="summary-card">
          <div className="summary-icon">💰</div>
          <div className="summary-content">
            <h3>Total Revenue</h3>
            <div className="summary-value">
              {formatCurrency(sales.reduce((sum, sale) => sum + (sale.price * (sale.quantity || 1) || 0), 0))}
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">📦</div>
          <div className="summary-content">
            <h3>Total Orders</h3>
            <div className="summary-value">{sales.length}</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">📊</div>
          <div className="summary-content">
            <h3>Avg Order Value</h3>
            <div className="summary-value">
              {sales.length > 0 
                ? formatCurrency(sales.reduce((sum, sale) => sum + (sale.price * (sale.quantity || 1) || 0), 0) / sales.length)
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
              {sales.filter(sale => {
                const saleStatus = sale.normalized_status || normalizeStatus(sale.status);
                return saleStatus === 'completed';
              }).length}
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="sales-controls">
        <div className="controls-left">
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
              {getUniqueStatuses().map(status => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="search-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search items, orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="controls-right">
          <div className="page-size-group">
            <label>Show</label>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="page-size-select"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span>per page</span>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="sales-table-container">
        <div className="table-header">
          <h2>Sales Details</h2>
          <div className="table-info">
            <span className="results-count">
              Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} sales
            </span>
          </div>
        </div>

        {currentSales.length > 0 ? (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('sale_date')}>
                    Date {getSortIndicator('sale_date')}
                  </th>
                  <th className="sortable" onClick={() => handleSort('platform')}>
                    Platform {getSortIndicator('platform')}
                  </th>
                  <th className="sortable" onClick={() => handleSort('item_title')}>
                    Item {getSortIndicator('item_title')}
                  </th>
                  <th className="sortable" onClick={() => handleSort('order_id')}>
                    Order ID {getSortIndicator('order_id')}
                  </th>
                  <th className="sortable" onClick={() => handleSort('quantity')}>
                    Qty {getSortIndicator('quantity')}
                  </th>
                  <th className="sortable" onClick={() => handleSort('price')}>
                    Price {getSortIndicator('price')}
                  </th>
                  <th className="sortable" onClick={() => handleSort('price')}>
                    Revenue {getSortIndicator('price')}
                  </th>
                  <th className="sortable" onClick={() => handleSort('status')}>
                    Status {getSortIndicator('status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentSales.map((sale, index) => (
                  <tr key={`${sale.id || sale.order_id}-${sale.item_id}-${index}`}>
                    <td>{formatDate(sale.sale_date)}</td>
                    <td>
                      <div className="platform-cell">
                        <span className="platform-icon">{getPlatformIcon(sale.platform)}</span>
                        <span className="platform-name">{sale.platform}</span>
                      </div>
                    </td>
                    <td className="item-cell">{sale.item_title}</td>
                    <td>{sale.order_id}</td>
                    <td>{sale.quantity || 1}</td>
                    <td>{formatCurrency(sale.price)}</td>
                    <td>{formatCurrency(sale.price * (sale.quantity || 1))}</td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(sale.status) }}
                      >
                        {sale.normalized_status || normalizeStatus(sale.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No sales data available</h3>
            <p>
              {searchTerm 
                ? `No sales found matching "${searchTerm}". Try adjusting your search terms.`
                : 'Your platforms are connected but no sales data has been synced yet. Click "Sync Data" to fetch your latest sales from connected platforms.'
              }
            </p>
            <div className="empty-actions">
              <button className="sync-btn" onClick={syncData}>
                <span className="btn-icon">🔄</span>
                Sync Data
              </button>
              {searchTerm && (
                <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
                  <span className="btn-icon">❌</span>
                  Clear Search
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              <span>Page {currentPage} of {totalPages}</span>
            </div>
            
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              
              <div className="page-numbers">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      className={`page-number ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Platform Breakdown */}
      {sales.length > 0 && (
        <div className="platform-breakdown">
          <h2>Platform Performance</h2>
          <div className="platform-cards">
            {['etsy', 'ebay', 'amazon', 'swell'].map(platform => {
              const platformSales = sales.filter(sale => 
                sale.platform?.toLowerCase() === platform
              );
              const platformRevenue = platformSales.reduce((sum, sale) => 
                sum + (sale.price * (sale.quantity || 1) || 0), 0
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