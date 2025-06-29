import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { 
  Filter, 
  Download, 
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign
} from 'lucide-react';

const Sales = () => {
  const [filters, setFilters] = useState({
    platform: '',
    start_date: '',
    end_date: '',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('sale_date');
  const [sortOrder, setSortOrder] = useState('DESC');
  const itemsPerPage = 20;

  const { data: salesData, isLoading } = useQuery(
    ['sales', filters, currentPage, sortBy, sortOrder],
    async () => {
      const params = new URLSearchParams({
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
        sort_by: sortBy,
        sort_order: sortOrder,
        ...filters
      });

      const response = await axios.get(`/api/sales?${params}`);
      return response.data;
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
  };

  const handleExport = async (format = 'json') => {
    try {
      const params = new URLSearchParams({
        format,
        ...filters
      });

      if (format === 'csv') {
        window.open(`/api/sales/export?${params}`, '_blank');
      } else {
        const response = await axios.get(`/api/sales/export?${params}`);
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sales-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const totalPages = Math.ceil((salesData?.total || 0) / itemsPerPage);

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
        <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => handleExport('json')}
            className="btn btn-outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="btn btn-outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="form-label">Platform</label>
            <select
              value={filters.platform}
              onChange={(e) => handleFilterChange('platform', e.target.value)}
              className="form-input"
            >
              <option value="">All Platforms</option>
              <option value="etsy">Etsy</option>
              <option value="ebay">eBay</option>
              <option value="amazon">Amazon</option>
            </select>
          </div>
          
          <div>
            <label className="form-label">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="form-input"
            />
          </div>
          
          <div>
            <label className="form-label">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="form-input"
            />
          </div>
          
          <div>
            <label className="form-label">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search items..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="form-input pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ platform: '', start_date: '', end_date: '', search: '' })}
              className="btn btn-outline w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Sales ({salesData?.total || 0} total)
          </h2>
        </div>

        {salesData?.sales?.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th 
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('sale_date')}
                    >
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Date</span>
                        {sortBy === 'sale_date' && (
                          <span>{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('platform')}
                    >
                      Platform
                    </th>
                    <th 
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('item_title')}
                    >
                      Item
                    </th>
                    <th>Quantity</th>
                    <th 
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('price')}
                    >
                      <div className="flex items-center space-x-1">
                        <DollarSign className="w-4 h-4" />
                        <span>Price</span>
                        {sortBy === 'price' && (
                          <span>{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th>Buyer</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {format(new Date(sale.sale_date), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-gray-500">
                            {format(new Date(sale.sale_date), 'HH:mm')}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${sale.platform}`}>
                          {sale.platform}
                        </span>
                      </td>
                      <td>
                        <div className="max-w-xs">
                          <div className="font-medium text-gray-900 truncate">
                            {sale.item_title}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {sale.item_id}
                          </div>
                        </div>
                      </td>
                      <td className="text-center">{sale.quantity}</td>
                      <td>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            ${sale.price}
                          </div>
                          <div className="text-sm text-gray-500">
                            {sale.currency}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="max-w-xs">
                          <div className="font-medium text-gray-900 truncate">
                            {sale.buyer_name}
                          </div>
                          {sale.buyer_email && (
                            <div className="text-sm text-gray-500 truncate">
                              {sale.buyer_email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          sale.status === 'Shipped' || sale.status === 'PAID_AND_SHIPPED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, salesData.total)} of{' '}
                  {salesData.total} results
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-outline"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-outline"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No sales found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sales; 