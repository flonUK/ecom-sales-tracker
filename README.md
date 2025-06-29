# E-Commerce Sales Tracker

A full-stack web application for tracking and analyzing sales across multiple e-commerce platforms including Etsy, eBay, Amazon, and Swell. Built with React frontend and Node.js backend with SQLite database.

## 🚀 Features

### Multi-Platform Integration
- **Swell** - Full API integration with pagination and lifetime data fetching
- **Etsy** - Ready for API integration
- **eBay** - Ready for API integration  
- **Amazon** - Ready for API integration

### Dashboard & Analytics
- **Real-time Sales Dashboard** - Revenue, orders, and platform breakdown
- **Customer Analytics** - Customer lifetime value, frequent buyers, repeat rates
- **Sales Analytics** - Revenue trends, top products, platform performance
- **Advanced Filtering** - Date ranges (7d, 30d, 90d, 1y, lifetime), platform, status

### Sales Management
- **Comprehensive Sales Table** - Sortable, searchable, paginated
- **Status Tracking** - Completed, pending, cancelled orders
- **Order Details** - Item information, buyer details, shipping info
- **Revenue Calculation** - Including shipping costs and proper decimal handling

### User Management
- **JWT Authentication** - Secure login/register system
- **User Profiles** - Account management
- **Platform Connections** - API credential management

## 🛠️ Tech Stack

### Frontend
- **React** - Modern UI with hooks and context
- **CSS3** - Custom styling with responsive design
- **Recharts** - Interactive charts and graphs
- **React Router** - Client-side routing

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **SQLite** - Lightweight database
- **JWT** - Authentication tokens
- **CORS** - Cross-origin resource sharing

### APIs & Integrations
- **Swell Node SDK** - E-commerce platform integration
- **RESTful APIs** - Standard HTTP endpoints
- **Rate Limiting** - API protection

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Git

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ecom
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   npm install
   
   # Install frontend dependencies
   cd client
   npm install
   cd ..
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp env.example .env
   
   # Edit .env with your configuration
   nano .env
   ```

4. **Database Setup**
   ```bash
   # The database will be automatically created on first run
   # No manual setup required
   ```

5. **Start the application**
   ```bash
   # Start backend server (port 5001)
   npm start
   
   # In another terminal, start frontend (port 3000)
   cd client
   npm start
   ```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=5001
JWT_SECRET=your_jwt_secret_here
CORS_ORIGIN=http://localhost:3000
```

### Platform API Credentials

#### Swell Integration
1. Go to your Swell dashboard
2. Navigate to Settings > API
3. Copy your Store ID, Public Key, and Secret Key
4. Add them in the Connections page of the app

#### Other Platforms
- **Etsy**: Requires OAuth setup (ready for implementation)
- **eBay**: Requires API credentials (ready for implementation)
- **Amazon**: Requires MWS credentials (ready for implementation)

## 📊 Usage

### Getting Started
1. Register a new account or login
2. Connect your e-commerce platforms in the Connections page
3. Sync your data using the "Sync Now" button
4. View your dashboard and analytics

### Features Overview

#### Dashboard
- **Revenue Overview** - Total revenue, orders, and average order value
- **Platform Breakdown** - Revenue distribution across platforms
- **Recent Activity** - Latest orders and updates
- **Quick Actions** - Sync data and manage connections

#### Sales Page
- **Advanced Filtering** - Filter by platform, date range, and status
- **Search Functionality** - Search by item title, order ID, or platform
- **Sortable Columns** - Click headers to sort data
- **Pagination** - Navigate through large datasets

#### Analytics Page
- **Revenue Trends** - Daily revenue charts
- **Sales Trends** - Order volume over time
- **Platform Performance** - Revenue breakdown by platform
- **Top Products** - Best-selling items

#### Customers Page
- **Customer Lifetime Value** - Total spending per customer
- **Frequent Buyers** - Customers with multiple orders
- **High Value Customers** - Customers spending above threshold
- **Customer Search** - Find specific customers

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - Bcrypt password encryption
- **CORS Protection** - Cross-origin request security
- **Rate Limiting** - API abuse prevention
- **Input Validation** - Data sanitization and validation

## 📈 Data Management

### Database Schema
- **Users** - User accounts and authentication
- **API Credentials** - Platform connection details
- **Sales** - Order and transaction data
- **Platforms** - E-commerce platform information

### Data Sync
- **Automatic Sync** - Background data synchronization
- **Manual Sync** - On-demand data refresh
- **Incremental Updates** - Only fetch new/changed data
- **Error Handling** - Graceful failure recovery

## 🚀 Deployment

### Production Setup
1. Set `NODE_ENV=production` in environment variables
2. Configure production database (PostgreSQL recommended)
3. Set up SSL certificates for HTTPS
4. Configure reverse proxy (nginx/Apache)
5. Set up process manager (PM2)

### Docker Deployment
```bash
# Build and run with Docker
docker build -t ecom-sales-tracker .
docker run -p 5001:5001 ecom-sales-tracker
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `/docs` folder
- Review the API documentation

## 🔄 Changelog

### Version 1.0.0
- Initial release with Swell integration
- Complete dashboard and analytics
- User authentication system
- Multi-platform architecture
- Responsive design

## 🎯 Roadmap

- [ ] eBay API integration
- [ ] Amazon MWS integration
- [ ] Etsy OAuth integration
- [ ] Advanced reporting
- [ ] Email notifications
- [ ] Mobile app
- [ ] Multi-tenant support
- [ ] Advanced analytics
- [ ] Inventory management
- [ ] Shipping integration 