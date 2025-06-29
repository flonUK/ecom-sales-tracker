import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Sales.css';

const Sales = () => {
  const { token } = useContext(AuthContext);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sales', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSales(data.sales || []);
        setDemoMode(data.demoMode || false);
      } else {
        console.error('Failed to fetch sales');
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncSales = async () => {
    try {
      setSyncing(true);
      
      // Sync from all platforms
      const platforms = ['etsy', 'ebay', 'amazon'];
      const syncPromises = platforms.map(platform => 
        fetch(`/api/${platform}/sales`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => null)
      );

      await Promise.all(syncPromises);
      await fetchSales(); // Refresh the sales data
      
      alert('Sales data synced successfully!');
    } catch (error) {
      console.error('Error syncing sales:', error);
      alert('Failed to sync sales data');
    } finally {
      setSyncing(false);
    }
  };

  const exportSales = () => {
    const csvContent = generateCSV(sales);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const generateCSV = (salesData) => {
    const headers = ['Platform', 'Order ID', 'Item Title', 'Quantity', 'Price', 'Currency', 'Buyer Name', 'Sale Date', 'Status', 'Data Source'];
    const rows = salesData.map(sale => [
      sale.platform,
      sale.order_id,
      sale.item_title,
      sale.quantity,
      sale.price,
      sale.currency,
      sale.buyer_name,
      new Date(sale.sale_date).toLocaleDateString(),
      sale.status,
      sale.data_source || 'unknown'
    ]);
    
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  const filteredSales = sales.filter(sale => {
    const matchesFilter = filter === 'all' || sale.platform === filter;
    const matchesSearch = searchTerm === '' || 
      sale.item_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.buyer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.order_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.price * sale.quantity), 0);
  const totalItems = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0);

  if (loading) {
    return (
      <div className="sales-container">
        <h2>Sales Data</h2>
        <div className="loading">Loading sales data...</div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      <div className="sales-header">
        <h2>Sales Data</h2>
        
        {demoMode && (
          <div className="demo-mode-banner">
            <span className="demo-icon">🎯</span>
            <div>
              <strong>Sample Data Mode</strong>
              <p>Showing sample data for testing. Connect real platforms to see live sales data.</p>
            </div>
          </div>
        )}
      </div>

      <div className="sales-controls">
        <div className="controls-left">
          <div className="filter-group">
            <label>Platform:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Platforms</option>
              <option value="etsy">Etsy</option>
              <option value="ebay">eBay</option>
              <option value="amazon">Amazon</option>
            </select>
          </div>
          
          <div className="search-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search items, buyers, or order IDs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="controls-right">
          <button 
            onClick={syncSales} 
            disabled={syncing}
            className="sync-btn"
          >
            {syncing ? 'Syncing...' : '🔄 Sync Data'}
          </button>
          
          <button 
            onClick={exportSales}
            disabled={sales.length === 0}
            className="export-btn"
          >
            📊 Export CSV
          </button>
        </div>
      </div>

      <div className="sales-summary">
        <div className="summary-card">
          <h3>Total Sales</h3>
          <p className="summary-number">{filteredSales.length}</p>
        </div>
        <div className="summary-card">
          <h3>Total Revenue</h3>
          <p className="summary-number">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="summary-card">
          <h3>Total Items</h3>
          <p className="summary-number">{totalItems}</p>
        </div>
        <div className="summary-card">
          <h3>Data Source</h3>
          <p className="summary-text">
            {demoMode ? 'Sample Data' : 'Live Data'}
          </p>
        </div>
      </div>

      {filteredSales.length === 0 ? (
        <div className="no-sales">
          <p>No sales found matching your criteria.</p>
          {demoMode && (
            <p className="demo-note">
              💡 Connect platforms in the Connections tab to see sample data, or add real API credentials for live data.
            </p>
          )}
        </div>
      ) : (
        <div className="sales-table-container">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Order ID</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Buyer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale, index) => (
                <tr key={`${sale.platform}-${sale.order_id}-${index}`} className={sale.data_source === 'sample' ? 'sample-row' : ''}>
                  <td>
                    <span className={`platform-badge ${sale.platform}`}>
                      {sale.platform.toUpperCase()}
                    </span>
                  </td>
                  <td className="order-id">{sale.order_id}</td>
                  <td className="item-title">{sale.item_title}</td>
                  <td className="quantity">{sale.quantity}</td>
                  <td className="price">
                    ${sale.price.toFixed(2)} {sale.currency}
                  </td>
                  <td className="buyer">{sale.buyer_name}</td>
                  <td className="date">
                    {new Date(sale.sale_date).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={`status-badge ${sale.status.toLowerCase()}`}>
                      {sale.status}
                    </span>
                  </td>
                  <td>
                    <span className={`source-badge ${sale.data_source || 'unknown'}`}>
                      {sale.data_source === 'sample' ? '🎯 Sample' : '📊 Live'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {demoMode && (
        <div className="demo-help">
          <h3>💡 Sample Data Mode</h3>
          <p>You're currently viewing sample data for testing purposes. To see real sales data:</p>
          <ol>
            <li>Go to the <strong>Connections</strong> tab</li>
            <li>Connect your marketplace accounts</li>
            <li>Add real API credentials to your backend <code>.env</code> file</li>
            <li>Restart the backend server</li>
            <li>Reconnect your platforms</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default Sales; 