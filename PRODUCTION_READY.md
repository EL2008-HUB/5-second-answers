# 📦 5-Second Answers - Production Deployment Package

**Version:** 1.0.0  
**Status:** ✅ Ready for Production  
**Last Updated:** March 22, 2026

---

## Quick Start (Choose One)

### 🟢 Easiest: Deploy to Heroku (5 minutes)
```bash
heroku login
heroku create 5sec-answers-api
heroku addons:create heroku-postgresql:standard-0
heroku config:set OPENAI_API_KEY=sk-xxx
git push heroku main
```
👉 [Full Heroku Guide](./PRODUCTION_DEPLOYMENT.md#option-1-heroku-deployment-recommended---easiest)

### 🟡 Recommended: Linux Server (30 minutes)
```bash
# SSH to your Ubuntu 20.04 server
ssh ubuntu@your-server-ip

# Run one-line setup (TODO: create setup script)
bash <(curl -s https://your-repo/setup-linux.sh)
```
👉 [Full Linux Guide](./PRODUCTION_DEPLOYMENT.md#option-2-linux-server-aws-ec2-digitalocean-etc)

### 🟠 Advanced: AWS/DigitalOcean/Azure
👉 [See Platform-specific Templates](./ENV_TEMPLATES.md)

---

## 📋 Pre-Deployment Checklist

Before deploying, complete these steps:

### Infrastructure
- [ ] Choose hosting platform (Heroku recommended for quick start)
- [ ] Setup database (PostgreSQL 15+)
- [ ] Setup domain name
- [ ] Generate SSL certificate (if not platform-managed)
- [ ] Configure backups

### Credentials & Secrets
- [ ] Regenerate OpenAI API key (NOT development key)
- [ ] Regenerate Google Fact-Check API key (NOT development key)
- [ ] Generate strong admin key (32 characters minimum)
- [ ] Generate strong database password
- [ ] All keys stored in `.env` (never committed)

### Code & Database
- [ ] All endpoints tested locally
- [ ] Database migrations tested
- [ ] Demo data seeded successfully
- [ ] No errors in console

### Security
- [ ] Enable HTTPS/SSL
- [ ] Setup firewall rules
- [ ] Enable CORS for frontend only
- [ ] Rate limiting configured
- [ ] Admin key changed from default

### Monitoring
- [ ] Error tracking setup (Sentry recommended)
- [ ] Uptime monitoring configured
- [ ] Logs being collected
- [ ] Alerts configured

---

## 🚀 Deployment Steps

### Step 1: Prepare Environment
```bash
# Copy appropriate template
cp ENV_TEMPLATES.md  # Choose your platform
# Edit with your credentials
nano .env
```

### Step 2: Setup Secrets (Platform-specific)

**Heroku:**
```bash
heroku config:set \
  OPENAI_API_KEY=sk-xxxx \
  GOOGLE_FACT_CHECK_API_KEY=AIza-xxxx \
  ADMIN_KEY=long-secure-key
```

**Linux:**
```bash
# Edit .env locally, upload securely
scp .env ubuntu@server:/tmp/
ssh ubuntu@server
# Move to app directory with correct permissions
```

### Step 3: Deploy

**Heroku:**
```bash
git push heroku main
heroku logs --tail
```

**Linux:**
```bash
ssh ubuntu@server
cd /var/www/5sec-api/5second-answers-api
npm run db:migrate
npm run db:seed
pm2 restart 5sec-api
```

### Step 4: Verify

```bash
# Check health endpoint
curl https://your-domain.com/health

# Check API endpoint
curl https://your-domain.com/api/questions

# Check logs
# Heroku: heroku logs --tail
# Linux: pm2 logs 5sec-api
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) | Complete deployment guide for all platforms |
| [ENV_TEMPLATES.md](./ENV_TEMPLATES.md) | Environment configuration templates |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Pre/post deployment checklist |
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | API endpoint documentation |
| [DOCKER_QUICK_START.md](./DOCKER_QUICK_START.md) | Docker deployment option |

---

## 🏗️ Project Structure

```
5second-answers/
├── 5second-answers-api/              # Backend API
│   ├── Dockerfile                    # Docker configuration
│   ├── docker-compose.yml            # Docker Compose
│   ├── knexfile.js                   # Knex DB config
│   ├── start-production.sh           # Production startup
│   ├── package.json
│   ├── src/
│   │   ├── server.js                 # Express server
│   │   ├── backend/
│   │   │   ├── controllers/          # Route handlers
│   │   │   ├── services/             # Business logic
│   │   │   ├── routes/               # API routes
│   │   │   └── data/                 # Database layer
│   │   └── uploads/                  # Uploaded files
│   └── .env                          # Secrets (DO NOT COMMIT)
├── App.tsx                           # React Native frontend
├── PRODUCTION_DEPLOYMENT.md          # This file
├── ENV_TEMPLATES.md                  # Config templates
├── API_DOCUMENTATION.md              # API docs
└── README.md                         # Project overview
```

---

## 🔐 Security Best Practices

### Secrets Management ✓
- ✅ Use `.env` file (chmod 600)
- ✅ Use platform secrets (Heroku Config Vars, AWS Secrets Manager, etc.)
- ✅ Rotate API keys every 90 days  
- ✅ Never commit `.env` to Git

### Access Control ✓
- ✅ Strong passwords (20+ characters)
- ✅ SSH key authentication only
- ✅ Firewall rules (only ports 80, 443)
- ✅ CORS restricted to frontend domain
- ✅ Rate limiting enabled

### Data Protection ✓
- ✅ HTTPS/SSL enforced
- ✅ Database backups encrypted
- ✅ Regular database backups (daily)
- ✅ Backup restoration tested monthly

### Monitoring ✓
- ✅ Error tracking (Sentry, DataDog, etc.)
- ✅ Uptime monitoring
- ✅ Performance monitoring
- ✅ Security alerts configured

---

## 📊 Monitoring & Alerts

### Health Check Endpoint
```bash
curl https://api.yourdomain.com/health

# Response:
{
  "status": "healthy",
  "timestamp": "2026-03-22T15:30:45.123Z",
  "uptime": 3600,
  "database": "connected"
}
```

### Setup Uptime Monitoring
- **Option 1:** UptimeRobot (free) - https://uptimerobot.com
- **Option 2:** Pingdom - https://www.pingdom.com
- **Option 3:** Datadog - https://www.datadoghq.com

### Setup Error Tracking
- **Option 1:** Sentry (recommended) - https://sentry.io
- **Option 2:** Rollbar - https://rollbar.com
- **Option 3:** Airbrake - https://airbrake.io

---

## 🔄 Continuous Deployment (Optional)

Setup automatic deployments when you push to main:

### GitHub Actions + Heroku
```bash
# Generate Heroku auth token
heroku auth:token

# Add to GitHub Secrets (HEROKU_API_KEY)
# Workflow automatically deploys on push
```

### GitHub Actions + Linux Server
```bash
# Add SSH key to GitHub Secrets
# Workflow SSH's to server and pulls latest code
```

See `.github/workflows/docker-build.yml` for CI/CD setup.

---

## 📈 Scaling Guide

### Stage 1: MVP (Current)
- Single server
- Shared PostgreSQL
- ~1,000 users
- Estimated cost: $50-100/month

### Stage 2: Growing
- Backend + Database separation
- Read replicas for database
- ~10,000 users
- Estimated cost: $300-500/month

### Stage 3: Scale
- Multiple backend servers (load balanced)
- Managed database (AWS RDS, DigitalOcean, etc.)
- Redis caching
- CDN for static assets
- ~100,000 users
- Estimated cost: $2,000-5,000/month

---

## 🆘 Troubleshooting

### API Not Responding
```bash
# Check status
heroku ps -a 5sec-answers-api
# Or
pm2 status

# View logs
heroku logs --tail
# Or
pm2 logs 5sec-api

# Restart
heroku dyno:restart
# Or
pm2 restart 5sec-api
```

### Database Connection Failed
```bash
# Test connection
psql -h your-host -U your-user -d 5secondanswers

# Check credentials in .env
grep DB_ .env

# Check firewall
ping your-database-host
telnet your-database-host 5432
```

### Slow Queries
```bash
# Enable query logging
# In PostgreSQL: SET log_statement = 'all';

# Check slow queries
heroku postgres:diagnose

# Add database indexes
npm run db:migrate  # (includes indexes)
```

### Out of Memory
```bash
# Check memory usage
pm2 monit

# Increase Node.js heap
NODE_OPTIONS="--max-old-space-size=2048" npm start

# Or on Heroku:
heroku config:set NODE_OPTIONS="--max-old-space-size=1024"
```

---

## 📞 Support & Resources

### Documentation
- Node.js: https://nodejs.org/en/docs/
- Express.js: https://expressjs.com/
- PostgreSQL: https://www.postgresql.org/docs/
- Heroku: https://devcenter.heroku.com/

### Community
- Stack Overflow: #node.js #postgresql
- GitHub Issues: Open an issue in this repo
- Discord: Communities for Node.js developers

---

## ✅ Deployment Verification

After deployment, verify:

1. ✅ API is responding: `curl https://api.yourdomain.com/health`
2. ✅ Database connected: Check health endpoint
3. ✅ SSL working: Visit in browser, check certificate
4. ✅ CORS working: Test from frontend
5. ✅ Backups running: Check backup directory
6. ✅ Monitoring active: Check Sentry/UptimeRobot dashboard
7. ✅ Logs collected: Check logs in monitoring tool

---

## 🎉 You're Live!

Congratulations! Your API is now in production! 🚀

### Next Steps
1. Setup monitoring & alerts
2. Train team on deployment process
3. Create incident response plan
4. Schedule regular backups
5. Monitor performance metrics

### Maintenance Schedule
- **Daily:** Check error logs, verify uptime
- **Weekly:** Review performance metrics, update dependencies
- **Monthly:** Security updates, capacity review, cost optimization
- **Quarterly:** API key rotation, disaster recovery test

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-22 | Initial production release |

---

**Status:** ✅ Production Ready  
**Last Verified:** 2026-03-22  
**Next Review:** 2026-06-22
