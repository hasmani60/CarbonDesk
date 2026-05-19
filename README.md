# Carbon Accounting System

A comprehensive enterprise-grade carbon emissions tracking and management system with multi-tenant support, RBAC, and advanced analytics.

## Features

- **Multi-Tenant Architecture** - Complete data isolation per organization
- **Role-Based Access Control** - 4 roles with 30+ granular permissions
- **GHG Protocol Scopes 1, 2, 3** - Full emissions tracking with automatic CO2e calculation
- **Advanced Analytics** - Real-time emissions tracking with trajectory analysis
- **Task Management** - Assign and track emission verification tasks
- **Admin Monitoring** - Activity logging with IP tracking
- **Company Operations Portal** - Hidden admin interface for managing organizations
- **Production Ready** - MongoDB support, Docker, PM2, Nginx configuration
- **Security** - JWT authentication, rate limiting, CORS, helmet.js

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB 7.0 (Primary), SQLite 3 (Development)
- **Authentication**: JWT + bcrypt
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Winston, Morgan
- **Process Manager**: PM2

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **UI Components**: Radix UI
- **State Management**: React Context
- **HTTP Client**: Axios

## Quick Start

### Development

```bash
# 1. Clone repository
git clone <your-repo-url>
cd carbon-accounting

# 2. Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev

# 3. Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# Access application at http://localhost:5173
```

### With Docker (Development)

```bash
# Start MongoDB + Mongo Express GUI
docker-compose -f docker-compose.dev.yml up -d

# Access Mongo Express: http://localhost:8081 (admin/admin)
# Configure backend/.env with:
# MONGODB_URI=mongodb://admin:devpassword@localhost:27017/carbon_accounting_dev?authSource=admin
```

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive production deployment guide.

### Quick Production Setup with Docker

```bash
# 1. Configure environment
cp backend/.env.production.example backend/.env.production
# Edit .env.production with your MongoDB URI and secrets

# 2. Start services
docker-compose up -d

# 3. Migrate data (if upgrading from SQLite)
docker exec -it carbon-backend node scripts/migrate-to-mongodb.js

# 4. Check status
docker-compose logs -f backend
```

### Production Setup with PM2

```bash
# 1. Install dependencies
cd backend && npm install --production
cd ../frontend && npm install && npm run build

# 2. Configure environment
cp backend/.env.production.example backend/.env.production
# Edit .env.production

# 3. Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # Follow instructions
```

## MongoDB Migration

If migrating from SQLite to MongoDB:

```bash
# 1. Backup SQLite database
cp backend/database/carbon_accounting.db backend/database/carbon_accounting.db.backup

# 2. Configure MongoDB connection in .env.production

# 3. Run migration
cd backend
node scripts/migrate-to-mongodb.js

# The script will:
# - Connect to both databases
# - Migrate all data with relationships
# - Create indexes
# - Provide detailed progress report
```

## Environment Variables

### Backend (.env or .env.production)

```bash
# Application
NODE_ENV=production
PORT=5001
CLIENT_URL=https://your-domain.com

# Database
MONGODB_URI=mongodb://username:password@localhost:27017/carbon_accounting

# JWT
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
JWT_EXPIRE=7d
COMPANY_JWT_SECRET=your-company-jwt-secret-min-32-chars

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Security
CORS_ORIGINS=https://your-domain.com
RATE_LIMIT_MAX_REQUESTS=1000
```

### Frontend (.env.production)

```bash
VITE_API_URL=https://your-domain.com/api
VITE_APP_NAME=Carbon Accounting System
```

## API Documentation

### Authentication

```bash
# User Login
POST /api/auth/login
Content-Type: application/json

{
  "email": "demo@example.com",
  "password": "password123"
}

# Response
{
  "success": true,
  "token": "jwt-token",
  "user": {
    "id": 1,
    "name": "Demo Admin",
    "email": "demo@example.com",
    "role": "admin"
  }
}
```

### Emissions

```bash
# Get Emissions (Authenticated)
GET /api/emissions
Authorization: Bearer <token>

# Create Emission
POST /api/emissions
Authorization: Bearer <token>
Content-Type: application/json

{
  "scope": 1,
  "activity": "Fuel from Generator",
  "quantity": 100,
  "unit": "liters",
  "date": "2025-01-15"
}
```

### Health Check

```bash
GET /health

# Response
{
  "status": "OK",
  "database": "MongoDB (Active)",
  "version": "2.0.1",
  "features": {
    "multiTenant": true,
    "rbac": true,
    "taskManagement": true
  }
}
```

## Default Credentials

### Regular Users
- **Admin**: demo@example.com / password123
- **Analyst**: analyst@example.com / password123
- **Contributor**: contributor@example.com / password123
- **Viewer**: viewer@example.com / password123

### Company Operations
- **Super Admin**: admin@carbontrack-company.com / CompanyAdmin2025!

**⚠️ IMPORTANT**: Change all default passwords in production!

## Project Structure

```
carbon-accounting/
├── backend/
│   ├── config/           # Configuration files
│   │   ├── database.js   # MongoDB connection manager
│   │   └── logger.js     # Winston logger
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware
│   ├── models/           # MongoDB schemas
│   ├── routes/           # API routes
│   ├── scripts/          # Utility scripts
│   │   └── migrate-to-mongodb.js
│   ├── database/         # SQLite database (development)
│   ├── logs/             # Application logs
│   └── server.js         # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── context/      # React context
│   │   ├── services/     # API services
│   │   └── App.jsx       # Main component
│   └── vite.config.js    # Vite configuration
├── nginx/
│   └── nginx.conf        # Nginx reverse proxy config
├── docker-compose.yml    # Production Docker setup
├── docker-compose.dev.yml # Development Docker setup
├── Dockerfile            # Multi-stage Docker build
├── ecosystem.config.js   # PM2 configuration
├── mongo-init.js         # MongoDB initialization
├── DEPLOYMENT.md         # Deployment guide
└── README.md             # This file
```

## Roles and Permissions

| Role | Pages | Actions | Scopes |
|------|-------|---------|--------|
| **Admin** | All | Create, Read, Update, Delete, Verify, Manage Users | 1, 2, 3 |
| **Analyst** | Analytics, Settings | Read, Verify | 1, 2, 3 |
| **Contributor** | Input, Settings | Create, Read, Update, Delete (own data) | Configurable |
| **Viewer** | Dashboard, Monitor, Analytics | Read only | 1, 2, 3 |

## Security Features

- **JWT Authentication** with secure token storage
- **Password Hashing** with bcrypt (salt: 12)
- **Rate Limiting** (1000 req/15min general, 500 admin, 200 company)
- **CORS Protection** with configurable origins
- **Helmet.js** security headers
- **Input Validation** with express-validator
- **SQL Injection Prevention** with parameterized queries
- **Multi-Tenant Isolation** at database level
- **Activity Logging** with IP tracking
- **Session Management** with token expiration

## Scripts

```bash
# Backend
npm start          # Start server
npm run dev        # Development with nodemon
npm test           # Run tests
npm run seed       # Seed database

# Frontend
npm run dev        # Development server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Run ESLint

# Migration
node scripts/migrate-to-mongodb.js  # Migrate SQLite to MongoDB

# PM2
pm2 start ecosystem.config.js --env production
pm2 logs carbon-accounting-api
pm2 monit
pm2 restart carbon-accounting-api
```

## Monitoring

### PM2 Monitoring

```bash
pm2 monit                    # Real-time monitoring
pm2 logs                     # View logs
pm2 status                   # Process status
pm2 restart all              # Restart all processes
```

### Logs

```bash
# Application logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log

# PM2 logs
pm2 logs carbon-accounting-api --lines 100

# Docker logs
docker-compose logs -f backend
```

### Health Check

```bash
curl http://localhost:5001/health

# With Docker
curl http://localhost/health
```

## Database Management

### MongoDB

```bash
# Connect to MongoDB
mongosh "your-connection-string"

# Show databases
show dbs

# Use database
use carbon_accounting

# Show collections
show collections

# Query examples
db.users.find().pretty()
db.emissions.find({ organisation_id: "ORG-ABC-2025-123456" })
db.tasks.find({ status: "pending" })

# Create indexes
db.emissions.createIndex({ organisation_id: 1, date: -1 })

# Database statistics
db.stats()
```

### Backup and Restore

```bash
# Backup
mongodump --uri="your-connection-string" --out=/backup/$(date +%Y%m%d)

# Restore
mongorestore --uri="your-connection-string" /backup/YYYYMMDD/carbon_accounting

# Automated backup (add to crontab)
0 2 * * * /usr/local/bin/backup-mongodb.sh
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

## Troubleshooting

### MongoDB Connection Issues

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check connection string
echo $MONGODB_URI

# Test connection
mongosh "your-connection-string"
```

### Port Already in Use

```bash
# Find process using port 5001
sudo lsof -i :5001

# Kill process
sudo kill -9 <PID>
```

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs carbon-accounting-api --lines 100

# Check environment variables
pm2 env 0

# Restart with fresh logs
pm2 flush
pm2 restart carbon-accounting-api
```

## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Issues**: GitHub Issues
- **Email**: support@your-domain.com

## Changelog

### Version 2.0.0 - Production Ready with MongoDB

- ✅ MongoDB support with complete schema design
- ✅ Database migration script from SQLite to MongoDB
- ✅ Docker and Docker Compose configuration
- ✅ PM2 process management with clustering
- ✅ Nginx reverse proxy configuration
- ✅ Winston logger with file rotation
- ✅ Production environment configuration
- ✅ Health checks and monitoring
- ✅ Automated backup scripts
- ✅ Comprehensive deployment documentation

### Version 1.0.0 - Initial Release

- Multi-tenant architecture
- RBAC with 4 roles
- GHG Protocol Scopes 1, 2, 3
- Task management
- Activity logging
- SQLite database

---

Made with ❤️ for sustainable future
