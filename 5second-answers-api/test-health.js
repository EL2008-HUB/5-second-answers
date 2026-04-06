const http = require('http');

function testHealth() {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('✅ Health Check Response:');
      console.log(data);
      process.exit(0);
    });
  });

  req.on('error', (error) => {
    console.log('❌ Connection Error:', error.message);
    process.exit(1);
  });

  req.end();
}

testHealth();
