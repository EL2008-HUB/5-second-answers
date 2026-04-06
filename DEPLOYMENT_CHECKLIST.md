# 5-Second Answers - Docker & Production Deployment Checklist

## Pre-Deployment Tasks

### Code Quality
- [ ] All endpoints tested locally
- [ ] API responds correctly on `http://localhost:5000`
- [ ] Database migrations run successfully
- [ ] Demo data seeded correctly
- [ ] No console errors or warnings
- [ ] All dependencies in package.json
- [ ] .gitignore excludes `.env` and `node_modules`

### Security
- [ ] API keys NOT committed to GitHub
- [ ] `.env` file is in `.gitignore`
- [ ] All secrets stored in `.env.docker` or platform secrets
- [ ] CORS configured appropriately
- [ ] SQL injection protections in place (using Knex)
- [ ] Rate limiting configured
- [ ] Admin key changed from default

### Database
- [ ] PostgreSQL 18+ installed/ready
- [ ] Migrations tested locally
- [ ] Database backups configured
- [ ] Connection pooling configured in Knex
- [ ] Indexes created on frequently queried columns
- [ ] Demo data seeded

---

## Docker Local Testing

### Prerequisites
- [ ] Docker Desktop installed
- [ ] PostgreSQL password ready (Eli2008.,D)
- [ ] Port 5000 available
- [ ] Port 5432 available

### Build Phase
```bash
cd 5second-answers-api
docker build -t 5sec-api-test .
```
- [ ] Build completes without errors
- [ ] Image size reasonable (< 500MB)

### Run Phase
```bash
docker-compose up --build
```
- [ ] All services start successfully
- [ ] PostgreSQL healthy (shows "healthy" status)
- [ ] API server running on port 5000
- [ ] Migrations completed
- [ ] Seed data inserted

### Test Phase
```bash
node run-api-tests.js
```
- [ ] All endpoints respond with 200 status
- [ ] Questions endpoint returns demo data
- [ ] Admin endpoints working
- [ ] No connection errors

### Cleanup
```bash
docker-compose down
docker system prune -a
```
- [ ] No orphaned containers/images
- [ ] Volumes cleaned up

---

## Production Deployment Checklist

### Choose Deployment Platform

#### Option 1: Docker Hub + Self-Hosted
- [ ] Docker Hub account created (https://hub.docker.com)
- [ ] Repository created on Docker Hub
- [ ] Docker credentials saved locally

**Steps:**
```bash
docker build -t yourusername/5sec-api:v1.0.0 .
docker push yourusername/5sec-api:v1.0.0
```

#### Option 2: Heroku
- [ ] Heroku account created (https://heroku.com)
- [ ] Heroku CLI installed
- [ ] PostgreSQL add-on available

**Steps:**
```bash
heroku login
heroku create 5sec-answers-api
heroku container:push web
heroku container:release web
```

#### Option 3: AWS ECS
- [ ] AWS account with IAM user
- [ ] ECR repository created
- [ ] RDS PostgreSQL database created
- [ ] ECS cluster configured

**Steps:**
- [ ] Build and push to ECR
- [ ] Create ECS task definition
- [ ] Create ECS service
- [ ] Configure load balancer

#### Option 4: Google Cloud Run
- [ ] Google Cloud account
- [ ] Project created
- [ ] Cloud SQL PostgreSQL database
- [ ] gcloud CLI installed

**Steps:**
```bash
gcloud run deploy 5sec-api \
  --source . \
  --platform managed
```

#### Option 5: DigitalOcean / Linode / Vultr
- [ ] Account created and funded
- [ ] SSH key configured
- [ ] Droplet/VM created with Docker pre-installed
- [ ] Domain registered and pointing to server

**Steps:**
- [ ] SSH into server
- [ ] Clone repository
- [ ] Setup `.env` with production values
- [ ] Run `docker-compose up -d`

### Environment Configuration

- [ ] Copy `.env.docker` → `.env.production`
- [ ] Set `NODE_ENV=production`
- [ ] Configure `DB_HOST` for production database
- [ ] Configure `DB_PASSWORD` (strong password)
- [ ] Set `OPENAI_API_KEY` to production key with budget limits
- [ ] Set `GOOGLE_FACT_CHECK_API_KEY`
- [ ] Generate strong `ADMIN_KEY`
- [ ] Set `FRONTEND_URL` to production domain
- [ ] Port not exposed publicly unless behind reverse proxy

### Database Setup (Production)

- [ ] PostgreSQL instance provisioned
- [ ] Backups automated (daily)
- [ ] Connection pooling configured
- [ ] SSL connections enabled
- [ ] Firewall rules restrict access to app only
- [ ] Database user has limited permissions (no superuser)
- [ ] Migrations tested on production DB
- [ ] Seed data loaded if needed

### Reverse Proxy & SSL

- [ ] NGINX or Apache configured
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] HTTPS redirect enforced
- [ ] CORS headers configured
- [ ] Gzip compression enabled
- [ ] API rate limiting configured

### Monitoring & Logging

- [ ] Error tracking setup (Sentry, DataDog, etc.)
- [ ] Application logging configured
- [ ] Database query logging enabled
- [ ] Uptime monitoring configured
- [ ] Alert notifications setup (Slack, email)
- [ ] Health check endpoint configured

### Performance

- [ ] Database connection pooling optimized
- [ ] Caching layer configured if needed
- [ ] API response times monitored
- [ ] Database query performance reviewed
- [ ] Unused migrations/seeds removed

### Security (Production)

- [ ] Firewall rules configured
- [ ] SSH access restricted
- [ ] Fail2ban or similar configured
- [ ] DDoS protection enabled
- [ ] API keys rotated quarterly
- [ ] Database backups encrypted
- [ ] Secrets not logged
- [ ] OWASP top 10 protections in place

### Backup & Recovery

- [ ] Database backups automated
- [ ] Backup retention policy set (30+ days)
- [ ] Backup restoration tested
- [ ] Application logs backed up
- [ ] Disaster recovery plan documented

### Domain & DNS

- [ ] Domain purchased
- [ ] DNS records configured
- [ ] A records point to server
- [ ] MX records if needed
- [ ] TTL values appropriate

### Final Checks

- [ ] All services running: `docker ps`
- [ ] Database connected: `psql -h <host> ...`
- [ ] API responding: `curl https://api.yourdomain.com/api/questions`
- [ ] Health check passing
- [ ] Error logs clean
- [ ] Performance acceptable

---

## Post-Deployment

### Day 1
- [ ] Monitor error logs
- [ ] Verify all endpoints working
- [ ] Check database connection stability
- [ ] Monitor server resources
- [ ] Test full user flow
- [ ] Notify team about go-live

### Week 1
- [ ] Monitor performance metrics
- [ ] Collect user feedback
- [ ] Check for issues/bugs
- [ ] Optimize slow queries
- [ ] Document any issues found

### Weekly
- [ ] Review error logs
- [ ] Check database size growth
- [ ] Monitor API response times
- [ ] Verify backups successful
- [ ] Update dependencies if needed

### Monthly
- [ ] Security updates
- [ ] Performance review
- [ ] Capacity planning
- [ ] Cost optimization
- [ ] Team retrospective

---

## Rollback Plan

If deployment fails:

1. **Revert Immediately:**
   ```bash
   docker-compose down
   git checkout previous-commit
   docker-compose up
   ```

2. **Check logs:**
   ```bash
   docker-compose logs api
   docker-compose logs db
   ```

3. **Restore from backup:**
   - Get latest clean database backup
   - Restore to PostgreSQL
   - Verify data integrity

4. **Communicate:**
   - Notify stakeholders
   - Document issue
   - Plan fix for next deployment

---

## Support & Documentation

- [ ] README updated with deployment info
- [ ] API documentation current
- [ ] runbook created for common issues
- [ ] Team trained on deployment
- [ ] On-call rotation setup
- [ ] Incident response plan documented

---

## Completion Checklist

- [ ] All local testing passed
- [ ] All pre-deployment items checked
- [ ] Deployment checklist reviewed
- [ ] Team approval obtained
- [ ] Deployment window scheduled
- [ ] Monitoring/alerts configured
- [ ] Rollback plan ready
- [ ] Documentation complete

**Deployment Date:** _______________
**Deployed By:** _______________
**Version:** _______________
**Notes:** _______________

---

**Status:** Ready for Production ✅
