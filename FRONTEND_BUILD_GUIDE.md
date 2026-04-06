# 🎯 Frontend Build & E2E Testing Guide

## Prerequisites

Before building the React Native frontend, ensure:

- ✅ Node.js 18+ installed
- ✅ Backend API running on `http://localhost:5000`
- ✅ PostgreSQL database connected
- ✅ Expo CLI installed: `npm install -g expo-cli`

---

## Step 1: Install Dependencies

```bash
cd /path/to/5second-answers

# Install frontend dependencies
npm install
```

---

## Step 2: Configure API Connection

The frontend is now configured to:
- Use `http://localhost:5000` by default
- Support environment variable override: `EXPO_PUBLIC_API_URL`

**For Development (Default):**
```bash
# No configuration needed - uses localhost:5000
npm start
```

**For Production:**
```bash
# Set your production API URL
EXPO_PUBLIC_API_URL=https://api.yourdomain.com npm start
```

---

## Step 3: Start Expo Development Server

```bash
# Navigate to project root
cd /path/to/5second-answers

# Start Expo (development):
npm start
# Or with classic build:
expo start
```

Choose your target:
```
i - Open iOS simulator
a - Open Android emulator  
w - Open web preview
j - Open debugger
r - Reload app
```

---

## Step 4: Run End-to-End Tests

There are three ways to test the integration:

### Option A: Run Tests in Debug Screen (Easiest)

Inside the running Expo app:
1. Navigate to the **Debug Screen** (add to navigation if needed)
2. Tap "🚀 Run E2E Tests" button
3. View results on screen
4. Check console for detailed logs

### Option B: Run Tests from Command Line

```bash
# Run test suite from terminal
npm test -- --testNamePattern="e2e"
```

### Option C: Manual Testing with Real Screens

1. **Ask Screen:** Post a question
   - Expected: Question appears in feed
   - API: `POST /api/questions`

2. **Upload Screen:** Submit an answer
   - Expected: Answer recorded and displayed
   - API: `POST /api/answers`

3. **Home Screen:** View feed
   - Expected: Questions and answers load
   - API: `GET /api/questions`, `GET /api/answers`

4. **Profile Screen:** View badges
   - Expected: User badges and stats display
   - API: `GET /api/admin/users`, `GET /api/admin/badges`

---

## Test Coverage

The E2E test suite covers:

| Test | Purpose | Passes When |
|------|---------|-------------|
| **Health Check** | Verify API is running | /health returns 200 |
| **Fetch Questions** | Test read operations | GET /api/questions returns data |
| **Create Question** | Test write operations | POST creates and returns ID |
| **Fetch Answers** | Test read operations | GET /api/answers returns data |
| **Create Answer** | Test write operations | POST creates and returns ID |
| **Admin Endpoints** | Test admin features | GET /api/admin/* returns data |
| **Response Times** | Performance check | All responses < 2000ms |
| **Full User Flow** | Integration test | Complete Q&A flow works |

---

## Troubleshooting

### "Cannot connect to localhost:5000"

**Problem:** Frontend can't reach backend

**Solution:**
```bash
# 1. Verify backend is running
curl http://localhost:5000/health
# Should return {"status":"healthy",...}

# 2. Check Expo is using correct URL
# In app, check console output

# 3. On mobile device, use your machine IP instead
EXPO_PUBLIC_API_URL=http://192.168.x.x:5000 npm start
# (Replace 192.168.x.x with your machine's local IP)
```

### "API_CONFIG not found"

**Problem:** Config file not imported correctly

**Solution:**
```typescript
// Make sure to import:
import { API_CONFIG } from '../config/api';
```

### Tests timeout or hang

**Problem:** Tests take too long or don't complete

**Solution:**
```bash
# 1. Check network connectivity
ping localhost

# 2. Verify backend health
curl http://localhost:5000/health

# 3. Increase timeout (in test file):
const API_CONFIG = { timeout: 60000 }; // 60 seconds
```

### CORS errors

**Error:** "Cross-Origin Request Blocked"

**Solution:**
```bash
# Backend has CORS enabled by default
# If issues persist, verify in src/server.js:
const cors = require('cors');
app.use(cors());
```

---

## Building for Production

### iOS Build

```bash
# Build for iOS
eas build --platform ios

# Or local build:
expo build:ios
```

Update in `app.json`:
```json
{
  "extra": {
    "environmentVariables": {
      "EXPO_PUBLIC_API_URL": "https://api.yourdomain.com"
    }
  }
}
```

### Android Build

```bash
# Build for Android
eas build --platform android

# Or local build:
expo build:android
```

### Web Build

```bash
# Build for web
npm run web
# Or:
expo export:web
```

---

## Performance Benchmarks

Target response times:

| Endpoint | Target | Critical |
|----------|--------|----------|
| GET /questions | < 200ms | < 500ms |
| GET /answers | < 200ms | < 500ms |
| POST /questions | < 300ms | < 800ms |
| POST /answers | < 300ms | < 800ms |
| /health | < 50ms | < 200ms |

Run test to verify:
```bash
# Enables performance monitoring
DEBUG=performance npm start
```

---

## Debug Mode Features

The Debug Screen includes:
- ✅ API configuration display
- ✅ Test runner UI
- ✅ Real-time results
- ✅ Performance metrics
- ✅ Console integration

**Remove before shipping to production!**

To disable:
```typescript
// Comment out in navigation:
// <Stack.Screen name="Debug" component={DebugScreen} />
```

---

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/frontend-build.yml`:

```yaml
name: Frontend Build & Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run type-check
      - run: npm run lint
      - run: npm run test:e2e
```

---

## Next Steps After Testing

✅ **Testing Complete?**

1. ✅ Verify all E2E tests pass
2. ✅ Check performance benchmarks
3. ✅ Test on physical devices (iOS + Android)
4. ✅ Fix any issues found
5. 🚀 **Ready to deploy!** → See PRODUCTION_DEPLOYMENT.md

---

## Additional Commands

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format

# Run specific test
npm test -- testName

# Watch mode
npm run test:watch

# Build for all platforms
npm run build:all

# Clean cache
npm start -- --clear

# Verbose logging
npm start -- --verbose
```

---

## Support & Resources

- Expo Docs: https://docs.expo.dev
- React Native Docs: https://reactnative.dev
- TypeScript: https://www.typescriptlang.org/docs/
- Troubleshooting: See DOCKER_DEPLOYMENT.md

---

**Status:** Ready for Frontend Testing ✅  
**API Connection:** Verified on localhost:5000 ✅  
**Next:** Run E2E Tests on Debug Screen 🧪
