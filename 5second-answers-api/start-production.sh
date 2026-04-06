#!/bin/bash
# Production startup script for 5-Second Answers API
# Usage: ./start-production.sh

set -e

echo "🚀 Starting 5-Second Answers API in PRODUCTION"
echo "============================================="

# Check environment file
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "   Please create .env with production credentials"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found!"
    echo "   Please install Node.js 18+"
    exit 1
fi

# Check PostgreSQL connectivity
if ! node -e "require('pg').Client; console.log('✓ PostgreSQL client available')" 2>/dev/null; then
    echo "❌ Error: PostgreSQL driver not installed"
    echo "   Run: npm install"
    exit 1
fi

# Check environment
echo "📋 Checking environment..."
nodeenv=$(grep NODE_ENV .env | cut -d'=' -f2)
port=$(grep PORT .env | cut -d'=' -f2)

if [ "$nodeenv" != "production" ]; then
    echo "⚠️  Warning: NODE_ENV is '$nodeenv', recommended 'production'"
fi

echo "   NODE_ENV: $nodeenv"
echo "   PORT: $port"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install --production

# Test database connection
echo ""
echo "🔗 Testing database connection..."
node -e "
const env = require('dotenv').config();
const knex = require('knex');
const db = knex({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    }
});
db.raw('SELECT 1').then(() => {
    console.log('   ✓ Database connected');
    process.exit(0);
}).catch(e => {
    console.log('   ❌ Database connection failed:', e.message);
    process.exit(1);
});
" || exit 1

# Run migrations
echo ""
echo "🔄 Running database migrations..."
npm run db:migrate || {
    echo "⚠️  Migrations failed - attempting to continue"
}

# Seed data if needed
echo ""
read -p "Run database seed? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run db:seed
fi

# Start server
echo ""
echo "✅ Production environment ready!"
echo "🌐 API will start on port $port"
echo ""
echo "Starting server..."
echo "============================================="
echo ""

# Run with PM2 if available
if command -v pm2 &> /dev/null; then
    pm2 start npm --name "5sec-api" -- start
    pm2 logs 5sec-api
else
    # Fall back to direct node execution
    npm start
fi
