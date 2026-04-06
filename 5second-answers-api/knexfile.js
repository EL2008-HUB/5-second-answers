// Update with your config settings.
require('dotenv').config();

const migrations = {
  directory: './src/backend/data/migrations'
};

const seeds = {
  directory: './src/backend/data/seeds'
};

const sharedConnection = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || '5secondanswers'
};

const sharedConfig = {
  client: 'pg',
  migrations,
  seeds
};

module.exports = {
  development: {
    ...sharedConfig,
    connection: sharedConnection
  },
  test: {
    ...sharedConfig,
    connection: sharedConnection
  },
  production: {
    ...sharedConfig,
    connection: process.env.DATABASE_URL || sharedConnection
  }
};
