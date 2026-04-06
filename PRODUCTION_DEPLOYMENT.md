# Production Deployment Guide - 5-Second Answers

## Overview

This guide covers deploying the 5-Second Answers API to production **without Docker** on traditional servers.

**Deployment Options:**
1. ✅ Linux Server (AWS EC2, DigitalOcean, Linode, Vultr)
2. ✅ Heroku (simplest - no Docker needed)
3. ✅ Windows Server
4. ✅ Virtual Private Server (VPS)

---

## Option 1: Heroku Deployment (Recommended - Easiest)

### Prerequisites
- Heroku account: https://www.heroku.com
- Heroku CLI installed: https://devcenter.heroku.com/articles/heroku-cli

### Step 1: Login & Create App
```bash
heroku login
heroku create 5sec-answers-api
# Or
heroku apps:create my-custom-name
```

### Step 2: Add PostgreSQL Database
```bash
heroku addons:create heroku-postgresql:standard-0
# Standard 0 = $50/month, 10GB storage
# For free tier testing, use hobby-dev:
heroku addons:create heroku-postgresql:hobby-dev
```

### Step 3: Add Environment Variables
```bash
heroku config:set NODE_ENV=production
heroku config:set OPENAI_API_KEY=sk-xxxxx
heroku config:set GOOGLE_FACT_CHECK_API_KEY=AIza-xxxxx
heroku config:set ADMIN_KEY=your-secure-admin-key-123
```

### Step 4: Deploy
```bash
git push heroku main
# Or from specific branch:
git push heroku develop:main
```

Heroku will:
- ✅ Detect Node.js app automatically
- ✅ Install dependencies from package.json
- ✅ Run migrations (add to Procfile)
- ✅ Start server

### Step 5: Verify
```bash
heroku logs --tail
curl https://your-app-name.herokuapp.com/api/questions
```

### Procfile Configuration (Create in root)
```
release: npm run db:migrate && npm run db:seed
web: npm start
```

**Cost:** $50/month (PostgreSQL) + free dyno = $50 total
**Time to deploy:** ~5 minutes
**Scalability:** Auto-scaling available

---

## Option 2: Linux Server (AWS EC2, DigitalOcean, etc.)

### Prerequisites
- Linux server running (Ubuntu 20.04 LTS recommended)
- SSH access to server
- Domain name (optional but recommended)

### Step 1: Install Dependencies

```bash
# SSH into server
ssh ubuntu@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 15
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-15 postgresql-contrib-15

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

### Step 2: Setup PostgreSQL

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database & user
CREATE DATABASE 5secondanswers;
CREATE USER appuser WITH PASSWORD 'your-secure-password';
ALTER ROLE appuser SET client_encoding TO 'utf8';
ALTER ROLE appuser SET default_transaction_isolation TO 'read committed';
ALTER ROLE appuser SET default_transaction_deferrable TO on;
ALTER ROLE appuser SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE 5secondanswers TO appuser;
\q
```

### Step 3: Clone & Setup Application

```bash
# Create app directory
sudo mkdir -p /var/www/5sec-api
cd /var/www/5sec-api

# Clone repository
sudo git clone https://your-repo-url .

# Fix permissions
sudo chown -R ubuntu:ubuntu /var/www/5sec-api
cd /var/www/5sec-api/5second-answers-api

# Install dependencies
npm install --production

# Create production .env
cat > .env << EOF
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=5secondanswers
DB_USER=appuser
DB_PASSWORD=your-secure-password
OPENAI_API_KEY=sk-xxxxx
GOOGLE_FACT_CHECK_API_KEY=AIza-xxxxx
ADMIN_KEY=your-secure-admin-key
EOF

# Run migrations
npm run db:migrate
npm run db:seed
```

### Step 4: Setup PM2 (Process Manager)

```bash
# Start app with PM2
pm2 start npm --name "5sec-api" -- start

# Save PM2 startup
pm2 save
pm2 startup

# Verify running
pm2 list
pm2 logs 5sec-api

# Monitor
pm2 monit
```

### Step 5: Setup Nginx (Reverse Proxy)

Create file: `/etc/nginx/sites-available/5sec-api`

```nginx
upstream 5sec_api {
  server 127.0.0.1:5000;
  keepalive 64;
}

server {
  listen 80;
  server_name your-domain.com www.your-domain.com;
  
  # Redirect HTTP to HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name your-domain.com www.your-domain.com;
  
  # SSL certificates (use Let's Encrypt with Certbot)
  ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
  
  # Security headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  
  # Gzip compression
  gzip on;
  gzip_types text/plain text/css text/javascript application/json application/javascript;
  
  location / {
    proxy_pass http://5sec_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }
}
```

Enable & test:
```bash
sudo ln -s /etc/nginx/sites-available/5sec-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal (runs daily)
sudo systemctl enable certbot.timer
```

### Step 7: Setup Backups

Create: `/home/ubuntu/backup-database.sh`

```bash
#!/bin/bash
BACKUP_DIR="/backups/5sec-api"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/5secondanswers_$TIMESTAMP.sql"

# Backup PostgreSQL
pg_dump -U appuser -h localhost 5secondanswers > $BACKUP_FILE
gzip $BACKUP_FILE

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Setup daily backup via cron:
```bash
chmod +x /home/ubuntu/backup-database.sh
crontab -e
```

Add line:
```
0 2 * * * /home/ubuntu/backup-database.sh
```

**Cost:** $5-20/month (depending on server size)
**Time to deploy:** ~30 minutes
**Scalability:** Manual scaling (upgrade server)

---

## Option 3: Windows Server

### Prerequisites
- Windows Server 2019+ or Windows 10 Pro
- Administrator access
- Domain name (optional)

### Step 1: Install Software

```powershell
# Install Chocolatey package manager (as Administrator)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs

# Install PostgreSQL
choco install postgresql18

# Install Git
choco install git
```

### Step 2: Setup as Windows Service

Use NSSM (Non-Sucking Service Manager):

```powershell
choco install nssm

# Create service
nssm install 5sec-api "C:\nodejs\node.exe" "C:\path\to\app\node_modules\.bin\npm start"
nssm set 5sec-api AppDirectory "C:\path\to\app"
nssm set 5sec-api AppEnvironmentExtra "NODE_ENV=production`nPORT=5000"

# Start service
nssm start 5sec-api

# Check status
nssm status 5sec-api
```

### Step 3: Setup IIS as Reverse Proxy

(Similar to Nginx setup above - uses URL Rewrite module)

**Cost:** $0 (if using existing Windows Server license)
**Time to deploy:** ~20 minutes
**Scalability:** Limited

---

## Post-Deployment Checklist

### Security
- [ ] Change all default passwords
- [ ] Enable firewall (only ports 80, 443)
- [ ] Setup HTTPS/SSL certificate
- [ ] Enable CORS for your frontend domain only
- [ ] Rate limiting enabled
- [ ] Admin key changed (not "admin-secret-key-123")
- [ ] Database backups encrypted
- [ ] SSH key authentication only (no password login)

### Monitoring
- [ ] Error tracking setup (Sentry, Rollbar, etc.)
- [ ] Uptime monitoring (UptimeRobot, Pingdom)
- [ ] Performance monitoring active
- [ ] Database query logging enabled
- [ ] API response times tracked

### Operations
- [ ] Automated backups running
- [ ] Backup restoration tested
- [ ] On-call rotation setup
- [ ] Incident response plan documented
- [ ] Runbook created for common issues
- [ ] Team trained on deployment process

### Performance
- [ ] Database indexes created
- [ ] Connection pooling configured
- [ ] Caching layer tested
- [ ] API response times acceptable
- [ ] Load test completed

---

## Health Check Endpoints

Add these endpoints to monitor your API:

```javascript
// GET /health
router.get('/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

// GET /metrics
router.get('/metrics', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  });
});
```

Monitor these endpoints:
```bash
# Via cron every 5 minutes
*/5 * * * * curl -f http://localhost:5000/health || alert "API is down"
```

---

## Rollback Procedure

If deployment fails:

1. **Revert code:**
   ```bash
   git revert HEAD
   npm install
   ```

2. **Restart service:**
   ```bash
   pm2 restart 5sec-api
   # Or
   systemctl restart 5sec-api
   ```

3. **Restore database from backup:**
   ```bash
   psql -U postgres 5secondanswers < /backups/latest-backup.sql
   ```

4. **Verify:**
   ```bash
   curl http://localhost:5000/health
   ```

---

## Updating to New Version

```bash
cd /var/www/5sec-api/5second-answers-api

# Pull latest code
git pull origin main

# Install any new dependencies
npm install --production

# Run migrations (if schema changed)
npm run db:migrate

# Restart service
pm2 restart 5sec-api

# Verify
curl http://localhost:5000/health
```

---

## Summary

| Platform | Cost | Time | Scalability | Difficulty |
|----------|------|------|-------------|-----------|
| **Heroku** | $50/mo | 5 min | Auto | Easy ⭐ |
| **Linux (EC2/DO)** | $5-20/mo | 30 min | Manual | Medium |
| **Windows Server** | $0+ | 20 min | Limited | Medium |

**Recommendation for starting:** Use **Heroku** for simplicity, then migrate to Linux server as you scale.

---

## Support

- Heroku docs: https://devcenter.heroku.com
- PostgreSQL docs: https://www.postgresql.org/docs/
- PM2 docs: https://pm2.keymetrics.io/
- Nginx docs: https://nginx.org/en/docs/
