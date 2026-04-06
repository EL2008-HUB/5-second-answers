const http = require('http');

const req = http.get('http://localhost:5000/api/questions', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('✅ API is responding!');
      console.log('Status:', res.statusCode);
      console.log('Response:', JSON.stringify(json, null, 2).substring(0, 500));
    } catch (e) {
      console.log('✅ API is responding (raw):', data.substring(0, 200));
    }
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.log('❌ API not responding:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('❌ Request timeout - API may not be running');
  process.exit(1);
}, 5000);
