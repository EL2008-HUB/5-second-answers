# 🚀 Production Environment Templates

## Template 1: Heroku Production

**File: `.env.heroku`**
```
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:password@host:5432/5secondanswers

# APIs
OPENAI_API_KEY=sk-regenerated-production-key
GOOGLE_FACT_CHECK_API_KEY=AIza-regenerated-production-key

# Security
ADMIN_KEY=generate-long-random-string-here
CORS_ORIGIN=https://yourdomain.com

# Monitoring
SENTRY_DSN=https://your-sentry-key@sentry.io/project-id
```

**Deploy:**
```bash
heroku config:set NODE_ENV=production
heroku config:set OPENAI_API_KEY=sk-xxxx
# ... rest of keys
git push heroku main
```

---

## Template 2: Linux Server (Production)

**File: `.env.production`**
```
# Server
NODE_ENV=production
PORT=5000

# Database (Local PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=5secondanswers
DB_USER=appuser
DB_PASSWORD=super-secure-random-password-min-20-chars
DATABASE_URL=postgresql://appuser:password@localhost:5432/5secondanswers

# APIs (Production Keys - Regenerated)
OPENAI_API_KEY=sk-prod-key-with-spending-limits
GOOGLE_FACT_CHECK_API_KEY=AIza-prod-key

# Security
ADMIN_KEY=generate-long-random-string-here
CORS_ORIGIN=https://yourdomain.com

# Email (Optional - for alerts)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-key

# Monitoring
SENTRY_DSN=https://your-sentry-key@sentry.io/project-id
LOG_LEVEL=info

# Backups
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
```

**Setup on Linux:**
```bash
# Copy template
cp .env.production .env

# Set secure permissions
chmod 600 .env

# Verify readonly
ls -la .env
# Should show: -rw------- (600)

# Never commit
echo ".env" >> .gitignore
```

---

## Template 3: AWS RDS + EC2

**File: `.env.aws`**
```
# Server
NODE_ENV=production
PORT=5000

# AWS RDS PostgreSQL
DB_HOST=myinstance.c9akciq32.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=5secondanswers
DB_USER=postgres
DB_PASSWORD=aws-rds-password-from-secrets-manager
DATABASE_URL=postgresql://postgres:password@myinstance.c9akciq32.us-east-1.rds.amazonaws.com:5432/5secondanswers

# APIs
OPENAI_API_KEY=sk-aws-production-key
GOOGLE_FACT_CHECK_API_KEY=AIza-aws-production-key

# AWS Specific
AWS_REGION=us-east-1
AWS_BUCKET=5sec-answers-uploads
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Security
ADMIN_KEY=generate-long-random-string-here
CORS_ORIGIN=https://yourdomain.com

# Monitoring
SENTRY_DSN=https://your-sentry-key@sentry.io/project-id
CLOUDWATCH_LOG_GROUP=/aws/ec2/5sec-api
```

---

## Template 4: DigitalOcean App Platform

**File: `.env.do`**
```
# Server
NODE_ENV=production
PORT=8080

# Database URL (provided by DO)
DATABASE_URL=postgresql://doadmin:xxxxx@db-xxx.ondigitalocean.com:25060/5secondanswers?sslmode=require&schema=public

# APIs
OPENAI_API_KEY=sk-do-production-key
GOOGLE_FACT_CHECK_API_KEY=AIza-do-production-key

# Security
ADMIN_KEY=generate-long-random-string-here
CORS_ORIGIN=https://yourdomain.com

# Monitoring
SENTRY_DSN=https://your-sentry-key@sentry.io/project-id
```

**app.yaml (DigitalOcean):**
```yaml
name: 5sec-answers-api
services:
- name: api
  github:
    repo: yourusername/5-second-answers
    branch: main
  build_command: npm install
  run_command: npm start
  envs:
  - key: NODE_ENV
    value: "production"
  - key: OPENAI_API_KEY
    scope: RUN_AND_BUILD_TIME
    value: ${OPENAI_API_KEY}
  http_port: 5000
databases:
- name: db
  engine: PG
  version: "15"
```

---

## Template 5: Azure App Service + Azure Database

**File: `.env.azure`**
```
# Server
NODE_ENV=production
PORT=8080

# Azure Database for PostgreSQL
DB_HOST=myserver.postgres.database.azure.com
DB_PORT=5432
DB_NAME=5secondanswers
DB_USER=pguser@myserver
DB_PASSWORD=azure-password-min-20-chars
DATABASE_URL=postgresql://pguser@myserver:password@myserver.postgres.database.azure.com:5432/5secondanswers?sslmode=require

# APIs
OPENAI_API_KEY=sk-azure-production-key
GOOGLE_FACT_CHECK_API_KEY=AIza-azure-production-key

# Azure Specific
AZURE_STORAGE_ACCOUNT=mystorageaccount
AZURE_STORAGE_KEY=...
AZURE_APP_INSIGHTS_KEY=...

# Security
ADMIN_KEY=generate-long-random-string-here
CORS_ORIGIN=https://yourdomain.com

# Monitoring
SENTRY_DSN=https://your-sentry-key@sentry.io/project-id
```

---

## Security Best Practices

### Never Store Secrets in Code ✗
```javascript
// BAD - Never do this
const OPENAI_KEY = "sk-xxxxx";
const DB_PASSWORD = "mypassword";
```

### Always Use Environment Variables ✓
```javascript
// GOOD
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DB_PASSWORD = process.env.DB_PASSWORD;
```

### Store Secrets in Platform Secrets Manager ✓

**Heroku:**
```bash
heroku config:set OPENAI_API_KEY=sk-xxx
```

**AWS:**
- Use AWS Secrets Manager
- Use Parameter Store

**DigitalOcean:**
- Use App Platform env variables

**Azure:**
- Use Key Vault

**Linux Server:**
- Use .env file (chmod 600)
- Consider Vault for large teams

---

## Environment Variable Validation

Add this to `src/server.js`:

```javascript
// Validate required environment variables
const requiredEnv = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD'
];

const missingEnv = requiredEnv.filter(env => !process.env[env]);

if (missingEnv.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnv.forEach(env => console.error(`   - ${env}`));
  process.exit(1);
}

// Optional but warn if missing
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set - AI features disabled');
}
```

---

## Secure Password Generation

Generate strong admin key and passwords:

```bash
# Generate 32-character random key
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or online: https://generate.plus/en/base64

# Example output: aB3xY9kL2mN8qR5sT1uV4wX7zC0dE6fG
```

---

## Configuration Checklist

- [ ] All environment variables set
- [ ] .env file has 600 permissions (chmod 600 .env)
- [ ] .env added to .gitignore
- [ ] Passwords are 20+ characters
- [ ] API keys are production keys (not development)
- [ ] CORS_ORIGIN is set to your frontend domain
- [ ] NODE_ENV=production
- [ ] Monitoring/Sentry configured
- [ ] Backups configured
- [ ] SSL certificate ready (if not platform-managed)

---

## Migration from Development to Production

```bash
# 1. Backup development database
npm run db:backup

# 2. Test all migrations on production database url
DATABASE_URL=production_url npm run db:migrate

# 3. Seed production data (if needed)
DATABASE_URL=production_url npm run db:seed

# 4. Start production server
NODE_ENV=production npm start
```
