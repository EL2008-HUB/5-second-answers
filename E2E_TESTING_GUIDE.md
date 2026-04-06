# 🧪 E2E Testing Quick Reference

## What Are E2E Tests?

E2E (End-to-End) tests verify that the entire system works together:
- Frontend ↔ Backend ↔ Database

They test complete user workflows from the app to the database and back.

---

## Test Scenarios Covered

```
1. Health Check
   └─ Verify API is running
   └─ GET /health → 200 OK

2. Fetch Questions
   └─ Retrieve all questions from database
   └─ GET /api/questions → Array of questions

3. Create Question
   └─ Post new question to database
   └─ POST /api/questions → Question created, ID returned

4. Fetch Answers
   └─ Retrieve all answers
   └─ GET /api/answers → Array of answers

5. Create Answer
   └─ Post new answer linked to question
   └─ POST /api/answers → Answer created, ID returned

6. Admin Endpoints
   └─ Verify admin features work
   └─ GET /api/admin/* → Admin data returned

7. Performance Check
   └─ Verify response times are acceptable
   └─ All responses < 2000ms (target < 500ms)

8. Full User Flow
   └─ Complete orchestrated workflow
   └─ Create question → Create answer → Verify both in DB
```

---

## Running Tests (3 Methods)

### Method 1: GUI (Easiest) ⭐

**Inside the running app:**

1. Start Expo:
   ```bash
   npm start
   ```

2. Choose platform: `i` (iOS) / `a` (Android) / `w` (Web)

3. Navigate to **Debug Screen** in your app (add to navigation)

4. Tap **"🚀 Run E2E Tests"** button

5. View results on screen:
   ```
   ✅ Health Check       0ms
   ✅ Fetch Questions   45ms
   ✅ Create Question   120ms
   ✅ Fetch Answers     35ms
   ✅ Create Answer     180ms
   ✅ Admin Endpoints   60ms
   ✅ Response Times    OK
   ✅ Full User Flow    500ms
   
   Tests Passed: 8/8
   ```

6. Check console (Ctrl+J) for detailed logs if any test fails

---

### Method 2: Command Line (npm)

```bash
# Install test dependencies if not present
npm install --save-dev jest ts-jest @types/jest

# Run tests
npm test -- src/__tests__/e2e.test.ts

# Expected output:
# PASS  src/__tests__/e2e.test.ts
# ✓ testHealthCheck (25ms)
# ✓ testFetchQuestions (50ms)
# ✓ testCreateQuestion (150ms)
# ✓ testFetchAnswers (40ms)
# ✓ testCreateAnswer (200ms)
# ✓ testAdminEndpoints (60ms)
# ✓ testResponseTimes (100ms)
# ✓ testFullUserFlow (600ms)
# 
# Tests:  8 passed, 8 total
```

---

### Method 3: Direct Node Execution

```bash
# Requires ts-node or babel-node
node --loader ts-node/esm src/__tests__/e2e.test.ts

# Or with ts-node:
ts-node src/__tests__/e2e.test.ts
```

---

## Expected Results

### ✅ All Tests Pass

```
Health Check:        ✓ API responding
Fetch Questions:     ✓ Retrieved questions
Create Question:     ✓ New question created
Fetch Answers:       ✓ Retrieved answers
Create Answer:       ✓ New answer created
Admin Endpoints:     ✓ Admin data retrieved
Response Times:      ✓ All < 2000ms
Full User Flow:      ✓ Complete flow successful

Summary: 8/8 PASSED ✅
```

→ **Status: Ready for Production Build**

---

### ❌ Tests Fail

Check common issues:

| Error | Fix |
|-------|-----|
| `Cannot connect to localhost:5000` | Verify backend running: `curl localhost:5000/health` |
| `ECONNREFUSED` | Start API: `npm run dev` (in 5second-answers-api/) |
| `timeout after 2000ms` | API too slow, check database queries |
| `Cannot find api.ts` | Ensure src/config/api.ts exists |
| `Module not found: e2e.test.ts` | Create file: `src/__tests__/e2e.test.ts` |
| `JSON parse error` | Backend not returning valid JSON |

---

## Performance Baseline

Expected response times (from local laptop):

| Endpoint | Expected | Max Acceptable |
|----------|----------|----------------|
| /health | 10-50ms | 200ms |
| GET /api/questions | 50-150ms | 500ms |
| GET /api/answers | 50-150ms | 500ms |
| POST /api/questions | 100-300ms | 800ms |
| POST /api/answers | 100-300ms | 800ms |
| /api/admin/* | 50-200ms | 500ms |

If slower:
- Check PostgreSQL performance
- Check backend CPU usage
- Check network latency
- Optimize database queries

---

## Interpreting Test Results

### Console Output

```javascript
// Example test result
{
  passed: 8,
  failed: 0,
  total: 8,
  duration: 3250,  // milliseconds
  tests: [
    {
      name: "Health Check",
      passed: true,
      duration: 25,
      error: null
    },
    {
      name: "Fetch Questions",
      passed: true,
      duration: 45,
      error: null
    }
    // ... more tests
  ]
}
```

### Metrics to Monitor

- **Total Duration:** Should be < 10 seconds for all 8 tests
- **Individual Test Duration:** Each test < 2000ms
- **Passed Count:** Must be 8/8
- **Failed Count:** Must be 0
- **Error Messages:** None (or handled gracefully)

---

## Debugging Failed Tests

### Step 1: Run Single Test

```bash
# Extract test name from output
# Then test individually

# Health check test only
npm test -- -t "Health"

# Create question test only
npm test -- -t "Create Question"
```

### Step 2: Check Backend

```bash
# Verify API is running
curl -v http://localhost:5000/health

# If fails: Start backend
cd 5second-answers-api
npm run dev

# You should see:
# Server running on port 5000
# Database connected: √
```

### Step 3: Check Database

```bash
# Verify PostgreSQL is connected
psql -U postgres -d 5secondanswers -c "SELECT COUNT(*) FROM questions;"

# Should return: count
#                -----
#                  (number of questions)

# If fails: Start PostgreSQL
# Mac: brew services start postgresql
# Windows: Services → PostgreSQL → Start
# Linux: sudo systemctl start postgresql
```

### Step 4: Review Test Code

```typescript
// src/__tests__/e2e.test.ts
// Check if test expectations match API responses

// Example: If GET /api/questions returns:
{
  "status": "success",
  "data": [/* questions */]
}

// Test should expect:
expect(response.data).toBeDefined();
```

### Step 5: Check Network

```bash
# Verify localhost:5000 is reachable
ping localhost

# OR on Mac:
nc -zv localhost 5000

# OR on Windows PowerShell:
Test-NetConnection localhost -Port 5000
```

---

## Common Issues & Fixes

### Issue: "TypeError: API_CONFIG is not defined"

**Fix:** Import API_CONFIG in test file
```typescript
import { API_CONFIG } from '../config/api';
```

### Issue: "Cannot find module '../config/api'"

**Fix:** Create src/config/api.ts (see FRONTEND_BUILD_GUIDE.md)

### Issue: "Network request failed"

**Fix:** Backend not running
```bash
cd 5second-answers-api
npm install  # if first time
npm run dev
```

### Issue: "Unexpected token <" (HTML response)

**Fix:** Endpoint not found (404)
```bash
# Verify correct endpoint:
curl http://localhost:5000/api/questions
# Should return JSON, not HTML error page
```

### Issue: "JSON.parse() unexpected token"

**Fix:** Backend returning invalid JSON
```bash
# Check raw response:
curl -v http://localhost:5000/api/questions 2>&1 | head -20
# Should start with '{' for JSON
```

---

## After Tests Pass ✅

Once all E2E tests pass:

1. **Build for Production**
   ```bash
   eas build --platform android  # or ios
   ```

2. **Install on Device**
   - Download APK/IPA
   - Install on test device
   - Test manually

3. **Deploy**
   - Follow PRODUCTION_DEPLOYMENT.md
   - Monitor for errors
   - Collect user feedback

4. **Celebrate** 🎉
   - Project complete
   - Ready for launch

---

## Resources

- E2E Test File: `src/__tests__/e2e.test.ts` (8 test functions)
- API Config: `src/config/api.ts` (centralized)
- Debug Screen: `src/screens/DebugScreen.tsx` (UI runner)
- Config: `app.json` (environment variables)
- Backend: `5second-answers-api/src/server.js`

---

## Quick Recap

| What | How | Where |
|------|-----|-------|
| Run via UI | Tap button in app | Debug Screen ⭐ |
| Run via CLI | npm test command | Terminal |
| View results | GUI or console | On screen or console |
| Fix failures | Check backend/DB | Start services |
| Next step | Build for prod | eas build command |

---

**Ready?** Start with Method 1 (GUI) - simplest! ✨
