import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Customers.css';

const Customers = () => {
  const { token } = useContext(AuthContext);
  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchCustomerData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Request unlimited results when "All time" is selected
      const limit = timeRange === 'all' ? 'all' : '100';
      
      const response = await fetch(`/api/sales/customers?days_back=${timeRange}&platform=${selectedPlatform}&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomerData(data);
      } else {
        console.error('Failed to fetch customer data');
        setCustomerData({
          customers: [],
          summary: {
            totalCustomers: 0,
            totalRevenue: 0,
            avgLTV: 0,
            frequentBuyers: 0,
            highValueCustomers: 0,
            repeatRate: 0
          }
        });
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
      setCustomerData({
        customers: [],
        summary: {
          totalCustomers: 0,
          totalRevenue: 0,
          avgLTV: 0,
          frequentBuyers: 0,
          highValueCustomers: 0,
          repeatRate: 0
        }
      });
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedPlatform, token]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  const formatCurrency = (amount) => {
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safeAmount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getCustomerTypeColor = (type) => {
    switch (type) {
      case 'Frequent Buyer': return '#10b981';
      case 'High Value': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getCustomerTypeIcon = (type) => {
    switch (type) {
      case 'Frequent Buyer': return '🔄';
      case 'High Value': return '💰';
      default: return '👤';
    }
  };

  // Filter customers based on search term
  const filteredCustomers = customerData?.customers?.filter(customer => {
    const matchesSearch = searchTerm === '' || 
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) || [];

  // Pagination calculations
  const totalItems = filteredCustomers.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="customers-container">
        <div className="customers-loading">
          <div className="loading-spinner"></div>
          <p>Loading customer data...</p>
        </div>
      </div>
    );
  }

  const data = customerData || {
    customers: [],
    summary: {
      totalCustomers: 0,
      totalRevenue: 0,
      avgLTV: 0,
      frequentBuyers: 0,
      highValueCustomers: 0,
      repeatRate: 0
    }
  };

  return (
    <div className="customers-container">
      {/* Header */}
      <div className="customers-header">
        <div className="header-left">
          <h1>Customer Analytics</h1>
          <p>Track customer lifetime value and frequent buyers</p>
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
            <option value="all">All time</option>
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

      {/* Customer Metrics */}
      <div className="customer-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <h3>Total Customers</h3>
            <div className="metric-value">{formatNumber(data.summary.totalCustomers)}</div>
            <div className="metric-period">Unique customers</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <h3>Total Revenue</h3>
            <div className="metric-value">{formatCurrency(data.summary.totalRevenue)}</div>
            <div className="metric-period">From all customers</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <h3>Average LTV</h3>
            <div className="metric-value">{formatCurrency(data.summary.avgLTV)}</div>
            <div className="metric-period">Customer lifetime value</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔄</div>
          <div className="metric-content">
            <h3>Frequent Buyers</h3>
            <div className="metric-value">{formatNumber(data.summary.frequentBuyers)}</div>
            <div className="metric-period">2+ orders</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⭐</div>
          <div className="metric-content">
            <h3>High Value</h3>
            <div className="metric-value">{formatNumber(data.summary.highValueCustomers)}</div>
            <div className="metric-period">£30+ spent</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <h3>Repeat Rate</h3>
            <div className="metric-value">
              {data.summary.repeatRate || 0}%
            </div>
            <div className="metric-period">Frequent buyer rate</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="customers-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search customers by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="pagination-controls">
          <select 
            value={pageSize} 
            onChange={(e) => setPageSize(parseInt(e.target.value))}
            className="page-size-select"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="customers-table-container">
        <div className="table-header">
          <h2>Customer Details</h2>
          <div className="table-info">
            <span className="results-count">
              Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} customers
            </span>
          </div>
        </div>

        {currentCustomers.length > 0 ? (
          <>
            <div className="customers-table">
              <div className="table-header-row">
                <div className="table-cell header">Customer</div>
                <div className="table-cell header">Type</div>
                <div className="table-cell header">Orders</div>
                <div className="table-cell header">Total Spent</div>
                <div className="table-cell header">Avg Order</div>
                <div className="table-cell header">First Order</div>
                <div className="table-cell header">Last Order</div>
              </div>

              {currentCustomers.map((customer, index) => (
                <div key={`${customer.email}-${index}`} className="table-row">
                  <div className="table-cell">
                    <div className="customer-info">
                      <div className="customer-name">{customer.name || 'Unknown'}</div>
                      <div className="customer-email">{customer.email || 'No email'}</div>
                    </div>
                  </div>
                  
                  <div className="table-cell">
                    <div className="customer-type">
                      <span className="type-icon">{getCustomerTypeIcon(customer.customerType)}</span>
                      <span 
                        className="type-badge"
                        style={{ backgroundColor: getCustomerTypeColor(customer.customerType) }}
                      >
                        {customer.customerType}
                      </span>
                    </div>
                  </div>
                  
                  <div className="table-cell">
                    <div className="order-count">{customer.orderCount}</div>
                  </div>
                  
                  <div className="table-cell">
                    <div className="total-spent">{formatCurrency(customer.totalSpent)}</div>
                  </div>
                  
                  <div className="table-cell">
                    <div className="avg-order">{formatCurrency(customer.avgOrderValue)}</div>
                  </div>
                  
                  <div className="table-cell">
                    <div className="first-order">{formatDate(customer.firstOrder)}</div>
                  </div>
                  
                  <div className="table-cell">
                    <div className="last-order">{formatDate(customer.lastOrder)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                
                <div className="page-numbers">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      className={`page-btn ${currentPage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No customers found</h3>
            <p>Connect your platforms and sync data to see customer analytics.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Customers; 