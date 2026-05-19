# Production Deployment Checklist

Use this checklist before deploying to production to ensure your Carbon Accounting System is secure and ready.

## 🔒 Security Configuration

### Environment Variables
- [ ] Generate strong `JWT_SECRET` (minimum 32 characters)
  ```bash
  openssl rand -base64 32
  ```
- [ ] Generate strong `COMPANY_JWT_SECRET` (minimum 32 characters)
- [ ] Set strong MongoDB credentials (username and password)
- [ ] Configure `CORS_ORIGINS` with your actual domain(s)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CLIENT_URL` with your production domain (HTTPS)

### Default Credentials
- [ ] Change default admin password (`demo@example.com`)
- [ ] Change default analyst password (`analyst@example.com`)
- [ ] Change default contributor password (`contributor@example.com`)
- [ ] Change default viewer password (`viewer@example.com`)
- [ ] Change company operator password (`admin@carbontrack-company.com`)
- [ ] Remove or disable test accounts

### Database Security
- [ ] MongoDB authentication enabled
- [ ] MongoDB uses strong passwords
- [ ] MongoDB bound to localhost or private network only
- [ ] Database backups configured
- [ ] Backup retention policy defined
- [ ] Test backup restoration process

### Application Security
- [ ] Rate limiting configured appropriately
- [ ] Helmet.js security headers enabled
- [ ] CORS properly configured (no wildcard origins)
- [ ] File upload limits set
- [ ] Input validation on all endpoints
- [ ] SQL injection protection verified

## 🌐 Network & Infrastructure

### SSL/TLS Configuration
- [ ] SSL certificates obtained (Let's Encrypt or purchased)
- [ ] HTTPS enabled on web server
- [ ] HTTP to HTTPS redirect configured
- [ ] SSL certificates auto-renewal configured
- [ ] TLS 1.2/1.3 only (disable older versions)

### Firewall Configuration
- [ ] UFW or iptables configured
- [ ] Port 22 (SSH) - restricted to specific IPs
- [ ] Port 80 (HTTP) - open for Let's Encrypt and redirects
- [ ] Port 443 (HTTPS) - open
- [ ] Port 27017 (MongoDB) - blocked from public internet
- [ ] Port 5001 (Backend) - accessible only via reverse proxy

### DNS Configuration
- [ ] Domain DNS records configured
- [ ] A records point to server IP
- [ ] CNAME records configured (if needed)
- [ ] TTL set appropriately

## 🐳 Deployment Setup

### Docker Deployment
- [ ] Docker and Docker Compose installed
- [ ] `.env.production` configured with production values
- [ ] Docker images built successfully
- [ ] Container health checks working
- [ ] Volume mounts configured for persistence
- [ ] Docker networks configured properly
- [ ] Resource limits set on containers

### PM2 Deployment
- [ ] PM2 installed globally
- [ ] `ecosystem.config.js` configured
- [ ] PM2 startup script configured
- [ ] PM2 process list saved
- [ ] Cluster mode enabled
- [ ] Memory limits set
- [ ] Auto-restart configured

### MongoDB Setup
- [ ] MongoDB 7.0+ installed or Atlas cluster created
- [ ] Database user created with appropriate permissions
- [ ] Connection string tested
- [ ] Indexes created (run migration script)
- [ ] IP whitelist configured (if using Atlas)
- [ ] MongoDB monitoring enabled

## 📊 Monitoring & Logging

### Logging Configuration
- [ ] Winston logger configured
- [ ] Log rotation enabled (max 5MB, 5 files)
- [ ] Error logs separate from combined logs
- [ ] Log level set appropriately (info for production)
- [ ] Access logs enabled (Morgan)

### Monitoring Setup
- [ ] Health check endpoint working (`/health`)
- [ ] PM2 monitoring enabled
- [ ] Server resource monitoring (CPU, RAM, disk)
- [ ] Database monitoring enabled
- [ ] Alert notifications configured
- [ ] Optional: Sentry/New Relic integrated

### Backup Strategy
- [ ] Automated MongoDB backups configured
- [ ] Backup schedule defined (e.g., daily at 2 AM)
- [ ] Backup retention policy (e.g., 30 days)
- [ ] Backups stored in separate location
- [ ] Backup restoration tested
- [ ] Backup monitoring/alerts configured

## 🚀 Application Deployment

### Frontend
- [ ] Frontend built for production (`npm run build`)
- [ ] Static assets optimized
- [ ] Environment variables configured
- [ ] API URL points to production backend
- [ ] Browser caching headers configured
- [ ] Service worker configured (if applicable)

### Backend
- [ ] Dependencies installed (`npm install --production`)
- [ ] Database migrations run
- [ ] SQLite to MongoDB migration completed (if applicable)
- [ ] All environment variables set
- [ ] Server starts without errors
- [ ] All routes tested

### Reverse Proxy (Nginx)
- [ ] Nginx installed and configured
- [ ] SSL/TLS certificates configured
- [ ] Rate limiting configured
- [ ] Gzip compression enabled
- [ ] Security headers configured
- [ ] Frontend static files served
- [ ] API proxy configured
- [ ] WebSocket support (if needed)

## ✅ Testing & Validation

### Functional Testing
- [ ] User login works
- [ ] User registration works (admin only)
- [ ] Emission data entry works
- [ ] Dashboard loads correctly
- [ ] Analytics pages work
- [ ] Admin panel accessible
- [ ] User management works
- [ ] Task management works
- [ ] Company operations portal works

### Security Testing
- [ ] CORS policy tested
- [ ] Rate limiting tested
- [ ] Authentication required on protected routes
- [ ] Authorization (RBAC) working correctly
- [ ] SQL injection tests passed
- [ ] XSS protection verified
- [ ] CSRF protection verified

### Performance Testing
- [ ] Load testing performed
- [ ] Response times acceptable
- [ ] Database queries optimized
- [ ] Indexes created for frequent queries
- [ ] Memory usage within limits
- [ ] CPU usage acceptable under load

### Integration Testing
- [ ] Frontend to backend communication works
- [ ] Database connections stable
- [ ] File uploads work
- [ ] Email notifications work (if configured)
- [ ] All API endpoints tested
- [ ] Error handling works correctly

## 📋 Documentation

### User Documentation
- [ ] README.md updated with production info
- [ ] User guide available
- [ ] API documentation available
- [ ] Default credentials documented
- [ ] Support contact information provided

### Technical Documentation
- [ ] DEPLOYMENT.md reviewed and accurate
- [ ] Architecture diagram available
- [ ] Database schema documented
- [ ] Environment variables documented
- [ ] Backup/restore procedures documented
- [ ] Troubleshooting guide available

## 🔧 Post-Deployment

### Immediate Checks
- [ ] Application accessible via domain
- [ ] SSL certificate valid and trusted
- [ ] Health check endpoint returns OK
- [ ] Login with test account works
- [ ] Create test emission entry
- [ ] View dashboard and analytics
- [ ] Check server logs for errors

### First 24 Hours
- [ ] Monitor server resources (CPU, RAM, disk)
- [ ] Check application logs for errors
- [ ] Monitor response times
- [ ] Check database performance
- [ ] Verify backup completed successfully
- [ ] Test user registration flow
- [ ] Monitor rate limit effectiveness

### First Week
- [ ] Review all logs for issues
- [ ] Check backup integrity
- [ ] Monitor user feedback
- [ ] Performance monitoring
- [ ] Security audit
- [ ] Update documentation as needed

## 🚨 Emergency Contacts & Procedures

### Emergency Contacts
- [ ] Server administrator contact defined
- [ ] Database administrator contact defined
- [ ] Application support contact defined
- [ ] Escalation procedures documented

### Rollback Plan
- [ ] Previous version tagged in git
- [ ] Rollback procedure documented
- [ ] Database rollback plan defined
- [ ] Emergency maintenance page prepared

## 📝 Compliance & Legal

### Data Protection
- [ ] GDPR compliance reviewed (if applicable)
- [ ] Privacy policy available
- [ ] Terms of service available
- [ ] Data retention policy defined
- [ ] User data export capability
- [ ] User data deletion capability

### Audit & Compliance
- [ ] Activity logging enabled
- [ ] Audit trail for all changes
- [ ] User access logs maintained
- [ ] Compliance requirements met
- [ ] Security policy documented

---

## Quick Reference Commands

### Health Check
```bash
curl https://your-domain.com/health
```

### View Logs
```bash
# PM2 logs
pm2 logs carbon-accounting-api

# Application logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Docker logs
docker-compose logs -f backend
```

### Database Backup
```bash
# MongoDB backup
mongodump --uri="mongodb://username:password@localhost:27017/carbon_accounting" \
  --out=/backup/$(date +%Y%m%d)
```

### Restart Services
```bash
# PM2
pm2 restart carbon-accounting-api

# Docker
docker-compose restart backend

# Nginx
sudo systemctl restart nginx
```

### Monitor Performance
```bash
# PM2 monitoring
pm2 monit

# System resources
htop
df -h
free -m
```

---

## Sign-Off

- [ ] **Development Lead**: Reviewed and approved
- [ ] **DevOps**: Infrastructure ready
- [ ] **Security**: Security review completed
- [ ] **QA**: Testing completed and passed
- [ ] **Product Owner**: Ready for production

**Deployment Date**: _______________

**Deployed By**: _______________

**Notes**: _______________________________________________

---

**🎉 Once all items are checked, your application is ready for production!**

For detailed instructions, see:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [README.md](./README.md) - Project overview and quick start
- [QUICK_START.md](./QUICK_START.md) - Quick setup guide
