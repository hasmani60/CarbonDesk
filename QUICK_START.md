# Quick Start Guide - Carbon Accounting System

Choose your deployment method:

## 1. Docker Deployment (Recommended) 🐳

### Prerequisites
- Docker and Docker Compose installed
- MongoDB connection string (MongoDB Atlas or local)

### Steps

```bash
# 1. Configure environment
cp backend/.env.production.example backend/.env.production

# 2. Edit .env.production - REQUIRED CHANGES:
nano backend/.env.production
# Set these variables:
#   MONGODB_URI=your-mongodb-connection-string
#   JWT_SECRET=generate-random-32-char-string
#   COMPANY_JWT_SECRET=generate-random-32-char-string
#   CLIENT_URL=http://localhost or https://your-domain.com

# 3. Start all services
docker-compose up -d

# 4. Migrate data from SQLite (if upgrading)
docker exec -it carbon-backend node scripts/migrate-to-mongodb.js

# 5. Check status
docker-compose ps
docker-compose logs -f backend

# 6. Access application
# Frontend: http://localhost
# Backend: http://localhost:5001
# Health: http://localhost:5001/health

# 7. Default login
# Email: demo@example.com
# Password: password123
```

### Management Commands

```bash
# View logs
docker-compose logs -f backend

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Update application
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

---

## 2. PM2 Deployment (Traditional) ⚡

### Prerequisites
- Node.js 18+ installed
- MongoDB running locally or MongoDB Atlas connection
- PM2 installed globally: `npm install -g pm2`

### Steps

```bash
# 1. Install dependencies
cd frontend
npm install
npm run build

cd ../backend
npm install --production

# 2. Configure environment
cp .env.production.example .env.production
nano .env.production
# Set MONGODB_URI, JWT_SECRET, COMPANY_JWT_SECRET

# 3. Migrate data from SQLite (if needed)
node scripts/migrate-to-mongodb.js

# 4. Start with PM2
cd ..
pm2 start ecosystem.config.js --env production

# 5. Save PM2 configuration
pm2 save

# 6. Enable PM2 startup on boot
pm2 startup
# Run the command it outputs

# 7. Access application
# Backend: http://localhost:5001
# Health: http://localhost:5001/health
```

### Management Commands

```bash
# View status
pm2 status

# View logs
pm2 logs carbon-accounting-api

# Monitor
pm2 monit

# Restart
pm2 restart carbon-accounting-api

# Stop
pm2 stop carbon-accounting-api

# Update application
git pull
cd frontend && npm install && npm run build
cd ../backend && npm install --production
pm2 reload carbon-accounting-api
```

---

## 3. Development Setup 💻

### Local Development (No Docker)

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Configure backend
cd backend
cp .env.example .env
nano .env
# For local MongoDB: MONGODB_URI=mongodb://localhost:27017/carbon_accounting_dev

# 3. Start MongoDB (if local)
# macOS: brew services start mongodb-community
# Linux: sudo systemctl start mongod
# Windows: net start MongoDB

# 4. Start backend (terminal 1)
cd backend
npm run dev

# 5. Start frontend (terminal 2)
cd frontend
npm run dev

# 6. Access application
# Frontend: http://localhost:5173
# Backend: http://localhost:5001
```

### Docker Development Environment

```bash
# 1. Start MongoDB + Mongo Express GUI
docker-compose -f docker-compose.dev.yml up -d

# 2. Configure backend/.env
MONGODB_URI=mongodb://admin:devpassword@localhost:27017/carbon_accounting_dev?authSource=admin

# 3. Start backend and frontend as above

# Access Mongo Express: http://localhost:8081
# Username: admin, Password: admin
```

---

## 4. MongoDB Setup Options

### Option A: MongoDB Atlas (Recommended)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create a cluster (free tier available)
4. Create database user
5. Whitelist IP (0.0.0.0/0 for testing, specific IP for production)
6. Get connection string
7. Update `.env.production`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/carbon_accounting?retryWrites=true&w=majority
   ```

### Option B: Local MongoDB

#### Ubuntu/Debian
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### macOS
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

#### Windows
Download from https://www.mongodb.com/try/download/community

---

## 5. Migrating from SQLite to MongoDB

```bash
# 1. Backup SQLite database
cp backend/database/carbon_accounting.db backend/database/carbon_accounting.db.backup

# 2. Ensure MongoDB is running and configured in .env

# 3. Run migration
cd backend
node scripts/migrate-to-mongodb.js

# 4. Verify migration
mongosh "your-connection-string"
use carbon_accounting
show collections
db.users.countDocuments()
db.emissions.countDocuments()
```

---

## 6. Environment Variables Quick Reference

### Required Variables

```bash
# .env.production (Backend)
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb://username:password@localhost:27017/carbon_accounting
JWT_SECRET=your-super-secure-random-32-character-secret-key
COMPANY_JWT_SECRET=your-company-super-secure-random-secret
CLIENT_URL=https://your-domain.com
```

### Generate Secure Secrets

```bash
# Generate JWT secrets (run these commands):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 7. Testing Your Deployment

### Health Check

```bash
curl http://localhost:5001/health
```

Expected response:
```json
{
  "status": "OK",
  "database": "MongoDB (Active)",
  "version": "2.0.1",
  "features": {
    "multiTenant": true,
    "rbac": true
  }
}
```

### Test Login

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"password123"}'
```

---

## 8. Default Credentials

### Regular Users
- **Admin**: demo@example.com / password123
- **Analyst**: analyst@example.com / password123
- **Contributor**: contributor@example.com / password123
- **Viewer**: viewer@example.com / password123

### Company Operations
- **Super Admin**: admin@carbontrack-company.com / CompanyAdmin2025!

**⚠️ CRITICAL**: Change these passwords immediately in production!

---

## 9. Common Issues

### MongoDB Connection Failed

```bash
# Check if MongoDB is running
sudo systemctl status mongod  # Linux
brew services list            # macOS

# Test connection
mongosh "your-connection-string"
```

### Port Already in Use

```bash
# Find process on port 5001
lsof -i :5001

# Kill process
kill -9 <PID>
```

### Permission Errors (Docker)

```bash
# Fix file permissions
sudo chown -R $USER:$USER .
```

---

## 10. Next Steps

After deployment:

1. **Change Default Passwords**
   ```bash
   # Login as admin and change passwords via UI or API
   ```

2. **Configure SSL** (Production)
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. **Setup Backups**
   ```bash
   # See DEPLOYMENT.md for backup scripts
   ```

4. **Monitor Logs**
   ```bash
   # Docker
   docker-compose logs -f backend

   # PM2
   pm2 logs carbon-accounting-api

   # Files
   tail -f backend/logs/combined.log
   ```

---

## Support

- 📖 **Full Documentation**: See `DEPLOYMENT.md`
- 🚀 **Production Guide**: See `README.md`
- 📝 **Summary**: See `PRODUCTION_READY_SUMMARY.md`
- 🔧 **Troubleshooting**: Check logs and health endpoint

---

**That's it! Your Carbon Accounting System is ready to go! 🎉**
