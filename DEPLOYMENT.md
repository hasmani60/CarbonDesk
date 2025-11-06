# Carbon Accounting System - Production Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [MongoDB Setup](#mongodb-setup)
3. [Migration from SQLite to MongoDB](#migration-from-sqlite-to-mongodb)
4. [Deployment Options](#deployment-options)
5. [Environment Configuration](#environment-configuration)
6. [Security Considerations](#security-considerations)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)

---

## Prerequisites

### System Requirements
- **Node.js**: v18.x or higher
- **MongoDB**: v7.0 or higher
- **RAM**: Minimum 2GB (4GB recommended)
- **Storage**: 20GB+ available space
- **OS**: Ubuntu 20.04/22.04 LTS, CentOS 8+, or compatible Linux distribution

### Required Tools
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Docker and Docker Compose (optional)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

---

## MongoDB Setup

### Option 1: Local MongoDB Installation

```bash
# Ubuntu/Debian
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Secure MongoDB
mongosh
```

```javascript
// In MongoDB shell
use admin
db.createUser({
  user: "admin",
  pwd: "YOUR_SECURE_PASSWORD",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ]
})

use carbon_accounting
db.createUser({
  user: "carbon_user",
  pwd: "YOUR_APP_PASSWORD",
  roles: [ { role: "readWrite", db: "carbon_accounting" } ]
})
```

### Option 2: MongoDB Atlas (Recommended)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user
4. Whitelist your IP address
5. Get your connection string
6. Replace in `.env.production`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/carbon_accounting?retryWrites=true&w=majority
   ```

---

## Migration from SQLite to MongoDB

### Step 1: Backup Your SQLite Database

```bash
cd backend/database
cp carbon_accounting.db carbon_accounting.db.backup_$(date +%Y%m%d_%H%M%S)
```

### Step 2: Configure MongoDB Connection

Create `.env.production` file:
```bash
cp backend/.env.production.example backend/.env.production
# Edit the file and add your MongoDB connection string
nano backend/.env.production
```

### Step 3: Run Migration Script

```bash
cd backend
npm install
node scripts/migrate-to-mongodb.js
```

The migration script will:
- Connect to both SQLite and MongoDB
- Migrate all data while preserving relationships
- Provide detailed progress and error reporting
- Create necessary indexes

### Step 4: Verify Migration

```bash
# Connect to MongoDB
mongosh "your-mongodb-connection-string"

# Check collections
use carbon_accounting
show collections

# Count documents
db.users.countDocuments()
db.emissions.countDocuments()
db.organisations.countDocuments()
```

---

## Deployment Options

### Option 1: Docker Deployment (Recommended)

#### Production Deployment

```bash
# 1. Clone repository
git clone <your-repo-url>
cd carbon-accounting

# 2. Create environment file
cp backend/.env.production.example backend/.env.production
# Edit and configure your environment variables
nano backend/.env.production

# 3. Build and start services
docker-compose up -d

# 4. Check logs
docker-compose logs -f backend

# 5. Access the application
# Backend: http://localhost:5001
# Frontend: http://localhost (via Nginx)
```

#### Development with Docker

```bash
# Start development environment with MongoDB GUI
docker-compose -f docker-compose.dev.yml up -d

# Access Mongo Express GUI
# URL: http://localhost:8081
# Username: admin
# Password: admin
```

### Option 2: PM2 Deployment (Traditional)

#### Step 1: Install Dependencies

```bash
# Backend
cd backend
npm install --production

# Frontend
cd ../frontend
npm install
npm run build
```

#### Step 2: Configure PM2

```bash
# Copy PM2 ecosystem file
cp ecosystem.config.js.example ecosystem.config.js

# Edit configuration if needed
nano ecosystem.config.js
```

#### Step 3: Start Application with PM2

```bash
# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Configure PM2 to start on boot
pm2 startup
# Follow the instructions printed by the command above

# Monitor application
pm2 monit

# View logs
pm2 logs carbon-accounting-api
```

#### PM2 Management Commands

```bash
# Status
pm2 status

# Restart
pm2 restart carbon-accounting-api

# Stop
pm2 stop carbon-accounting-api

# Reload (zero-downtime)
pm2 reload carbon-accounting-api

# Delete
pm2 delete carbon-accounting-api

# Flush logs
pm2 flush
```

### Option 3: Manual Deployment

```bash
# 1. Build frontend
cd frontend
npm install
npm run build

# 2. Start backend
cd ../backend
npm install --production
NODE_ENV=production node server.js
```

---

## Environment Configuration

### Backend Environment Variables (.env.production)

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
COMPANY_JWT_EXPIRE=24h

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@your-domain.com
FROM_NAME=Carbon Accounting System

# Security
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_ADMIN_MAX=500
```

### Frontend Environment Variables

Create `frontend/.env.production`:
```bash
VITE_API_URL=https://your-domain.com/api
VITE_APP_NAME=Carbon Accounting System
VITE_APP_VERSION=2.0.0
```

---

## Security Considerations

### 1. SSL/TLS Configuration

#### Using Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal (already configured by certbot)
sudo systemctl status certbot.timer
```

### 2. Firewall Configuration

```bash
# Configure UFW
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# MongoDB should NOT be exposed publicly
# Only allow from localhost
sudo ufw deny 27017/tcp
```

### 3. Nginx Security Headers

Already configured in `nginx/nginx.conf`:
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Content Security Policy

### 4. MongoDB Security

```javascript
// Enable authentication in /etc/mongod.conf
security:
  authorization: enabled

// Bind to localhost only (unless using replica set)
net:
  bindIp: 127.0.0.1
```

### 5. Application Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong JWT secrets (min 32 characters)
- [ ] Configure CORS origins correctly
- [ ] Enable rate limiting
- [ ] Keep dependencies updated
- [ ] Enable MongoDB authentication
- [ ] Use SSL/TLS for all connections
- [ ] Regular security audits: `npm audit`
- [ ] Implement backup strategy
- [ ] Configure log rotation

---

## Monitoring and Maintenance

### Application Logs

```bash
# PM2 logs
pm2 logs carbon-accounting-api

# Application logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

### Health Checks

```bash
# Application health
curl http://localhost:5001/health

# MongoDB health
mongosh --eval "db.adminCommand('ping')"
```

### Backup Strategy

#### MongoDB Backup

```bash
# Create backup directory
mkdir -p /var/backups/mongodb

# Backup script
mongodump --uri="mongodb://username:password@localhost:27017/carbon_accounting" \
  --out=/var/backups/mongodb/backup_$(date +%Y%m%d_%H%M%S)

# Restore from backup
mongorestore --uri="mongodb://username:password@localhost:27017/carbon_accounting" \
  /var/backups/mongodb/backup_YYYYMMDD_HHMMSS/carbon_accounting
```

#### Automated Backup (Cron)

```bash
# Create backup script
sudo nano /usr/local/bin/backup-mongodb.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup
mongodump --uri="mongodb://username:password@localhost:27017/carbon_accounting" \
  --out="$BACKUP_DIR/backup_$DATE"

# Compress
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" -C "$BACKUP_DIR" "backup_$DATE"
rm -rf "$BACKUP_DIR/backup_$DATE"

# Remove old backups
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-mongodb.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
```

### Performance Monitoring

#### PM2 Monitoring

```bash
# Built-in monitoring
pm2 monit

# Web dashboard (optional)
pm2 install pm2-server-monit
```

#### MongoDB Performance

```javascript
// In mongosh
use carbon_accounting

// Check slow queries
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().sort({ ts: -1 }).limit(5).pretty()

// Index usage
db.emissions.aggregate([
  { $indexStats: {} }
])

// Database stats
db.stats()
```

### Updates and Patches

```bash
# Update application
cd /path/to/carbon-accounting
git pull origin main

# Update dependencies
cd backend && npm update
cd ../frontend && npm update

# Rebuild frontend
cd frontend && npm run build

# Reload application (zero-downtime)
pm2 reload ecosystem.config.js --env production

# Or with Docker
docker-compose down
docker-compose build
docker-compose up -d
```

---

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Failed

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check connection string
echo $MONGODB_URI

# Test connection
mongosh "your-connection-string"
```

#### 2. PM2 Application Won't Start

```bash
# Check logs
pm2 logs carbon-accounting-api --lines 100

# Check errors
pm2 describe carbon-accounting-api

# Restart with fresh logs
pm2 flush
pm2 restart carbon-accounting-api
```

#### 3. High Memory Usage

```bash
# Check PM2 memory
pm2 monit

# Restart application
pm2 restart carbon-accounting-api

# Adjust max memory in ecosystem.config.js
max_memory_restart: '500M'
```

#### 4. Port Already in Use

```bash
# Find process using port 5001
sudo lsof -i :5001

# Kill process
sudo kill -9 <PID>
```

### Support and Documentation

- **GitHub Issues**: [Your repository URL]
- **Documentation**: See README.md
- **MongoDB Docs**: https://docs.mongodb.com/
- **PM2 Docs**: https://pm2.keymetrics.io/docs/

---

## Production Checklist

Before going live, ensure:

- [ ] MongoDB is secured with authentication
- [ ] SSL/TLS certificates are configured
- [ ] Environment variables are set correctly
- [ ] Firewall rules are configured
- [ ] Backup strategy is implemented
- [ ] Monitoring is set up
- [ ] Logs are being rotated
- [ ] PM2 is configured to start on boot
- [ ] Rate limiting is enabled
- [ ] CORS is configured correctly
- [ ] All default credentials are changed
- [ ] Security headers are configured
- [ ] Health check endpoints are working
- [ ] Application is running in cluster mode
- [ ] Error handling is tested
- [ ] Load testing is performed

---

## Support

For issues and questions:
- Check logs: `pm2 logs carbon-accounting-api`
- Review health endpoint: `curl http://localhost:5001/health`
- MongoDB status: `sudo systemctl status mongod`
- Application metrics: `pm2 monit`
