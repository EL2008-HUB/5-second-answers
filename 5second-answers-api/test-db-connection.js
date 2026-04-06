const knex = require('knex');
require('dotenv').config();

console.log('🔍 Connection Config:');
console.log('  Host:', process.env.DB_HOST);
console.log('  Port:', process.env.DB_PORT);
console.log('  User:', process.env.DB_USER);
console.log('  Database:', process.env.DB_NAME);
console.log('  Password: [HIDDEN]');

const config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres' // Connect to default DB first
  }
};

console.log('\n⏳ Testing connection...');

const db = knex(config);

db.raw('SELECT version();')
  .then(result => {
    console.log('✅ Connection successful!');
    console.log('PostgreSQL version:', result.rows[0].version);
    process.exit(0);
  })
  .catch(err => {
    console.log('❌ Connection failed');
    console.log('Error:', err.message);
    console.log('Code:', err.code);
    process.exit(1);
  });
