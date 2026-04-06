const knex = require('knex');
require('dotenv').config();

// First connect to 'postgres' (default DB) to create our database
const adminConfig = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres' // Connect to default database
  }
};

const adminDb = knex(adminConfig);

console.log('🔨 Creating database: 5secondanswers...');

adminDb.raw(`CREATE DATABASE "5secondanswers";`)
  .then(() => {
    console.log('✅ Database created successfully!');
    process.exit(0);
  })
  .catch(err => {
    if (err.message.includes('already exists')) {
      console.log('✅ Database already exists');
      process.exit(0);
    } else {
      console.log('❌ Error:', err.message);
      process.exit(1);
    }
  });
