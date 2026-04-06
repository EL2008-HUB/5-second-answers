# API Routes Quick Reference

**5-Second Answers Backend**  
**Base URL:** `http://localhost:5000/api`

---

## Index

- [Questions](#questions) (5 endpoints)
- [Answers](#answers) (6 endpoints)
- [AI Validation](#ai-validation) (1 endpoint)
- [Upload](#upload) (1 endpoint)
- [Admin Management](#admin-management) (8 endpoints)
- [Comments & Videos](#comments--videos) (stubs)

---

## Questions

### Create Question
```
POST /api/questions
Content-Type: application/json

{
  "text": "How do I fix TypeScript errors?",
  "category": "tech",
  "userId": "user-123"
}

Response: 201 Created
{
  "id": "q-uuid",
  "text": "How do I fix TypeScript errors?",
  "category": "tech",
  "userId": "user-123",
  "views": 0,
  "status": "active",
  "createdAt": "2026-03-22T10:30:00Z"
}
```

**Validation:** Text max 200 chars, non-empty

---

### List Questions
```
GET /api/questions
GET /api/questions?category=tech
GET /api/questions?category=tech&trending=true

Query Params:
  category (string): "tech", "cooking", "health", etc. Default: "all"
  trending (boolean): "true" | "false". Default: "false"

Response: 200 OK
[
  {
    "id": "q-uuid",
    "text": "How do I fix TypeScript errors?",
    "category": "tech",
    "views": 150,
    ...
  },
  ...
]
```

---

### Get Question by ID
```
GET /api/questions/q-uuid

Response: 200 OK
{
  "id": "q-uuid",
  "text": "How do I fix TypeScript errors?",
  "category": "tech",
  "views": 151,
  "answerCount": 5,
  ...
}

Note: Increments views by 1 on each call
```

---

### Get Personalized FYP Feed
```
GET /api/questions/feed
GET /api/questions/feed?category=tech
GET /api/questions/feed?sort=top
GET /api/questions/feed?sort=newest
GET /api/questions/feed?sort=trending
GET /api/questions/feed?limit=50

Query Params:
  category (string): Default: "all"
  sort (string): "top" | "newest" | "trending". Default: "top"
  limit (number): 1-100. Default: 20

Response: 200 OK
[
  {
    "id": "answer-uuid",
    "questionId": "q-uuid",
    "userId": "user-123",
    "type": "video",
    "contentUrl": "https://...",
    "interactions": { "likes": 42, "views": 156, "saves": 8 },
    "aiReview": { "approved": true, "score": 0.85 },
    "question": { "id": "q-uuid", "text": "...", "category": "tech" },
    "user": { "username": "dev_expert", "avatar": "https://..." },
    ...
  },
  ...
]

Ranking Algorithm:
  - Engagement (35%): likes × 3 + views × 0.5 + saves × 2
  - Recency (25%): exponential decay (50% per 24h)
  - Creator (25%): past engagement + experience
  - AI Confidence (15%): approval score
```

---

### Get Trending Questions
```
GET /api/questions/trending

Response: 200 OK
[
  {
    "id": "q-uuid",
    "text": "How do I fix TypeScript errors?",
    "category": "tech",
    "answerCount": 12,
    "totalViews": 450,
    ...
  },
  ...
]

Trending Score: (answer_count × 2) + total_views
```

---

## Answers

### Create Answer (with AI Validation)
```
POST /api/answers
Content-Type: application/json

{
  "questionId": "q-uuid",
  "userId": "user-123",
  "type": "video",
  "contentUrl": "https://storage.example.com/video.mp4",
  "text": null
}

Response: 201 Created
{
  "id": "answer-uuid",
  "questionId": "q-uuid",
  "userId": "user-123",
  "type": "video",
  "contentUrl": "https://...",
  "duration": 5,
  "interactions": { "likes": 0, "views": 0, "saves": 0 },
  "aiReview": {
    "approved": true,
    "feedback": "Clear and concise",
    "score": 0.82,
    "shortSummary": "Fix TypeScript..."
  },
  "status": "approved",
  "newBadges": ["star"],
  "createdAt": "2026-03-22T10:30:00Z"
}

Type Options:
  - "video": Must provide contentUrl
  - "audio": Must provide contentUrl
  - "text": Must provide text (max 70 chars ≈ 10 words)

Behavior:
  1. Validates question exists
  2. Calls AI validation
  3. Auto-approves if AI score > 0.7
  4. Checks badge unlocks
  5. Returns with newBadges array
```

**Validation:**
- `questionId` required
- `type` required, must be video/audio/text
- Video/audio: `contentUrl` required
- Text: `text` required, max 70 chars (≈10 words)

---

### Get Answers for Question
```
GET /api/answers/q-uuid
GET /api/answers/q-uuid?sort=top
GET /api/answers/q-uuid?sort=newest
GET /api/answers/q-uuid?sort=trending

Query Params:
  sort (string): "top" | "newest" | "trending". Default: "top"

Response: 200 OK
[
  {
    "id": "answer-uuid",
    "questionId": "q-uuid",
    "userId": "user-123",
    "type": "video",
    "interactions": { "likes": 42, "views": 156, "saves": 8 },
    "status": "approved",
    "user": { "username": "dev_expert", "avatar": "https://..." },
    ...
  },
  ...
]

Note: Returns only approved answers, ranked by sort parameter
```

---

### Like/View/Save Answer (Toggle)
```
POST /api/answers/answer-uuid/interact
Content-Type: application/json

{
  "type": "like",
  "userId": "user-456"
}

Response: 200 OK (if like/unlike)
{
  "liked": true,
  "likes": 43
}

OR if already liked (toggle off):
{
  "liked": false,
  "likes": 42
}

OR if view/save:
{
  "interaction": "view",
  "views": 157
}

Interaction Types:
  - "like" (toggleable): Like → Unlike
  - "view" (cumulative): Each call increments
  - "save" (cumulative): Each call increments

Behavior:
  - Triggers badge unlock checks for answer author
  - Updates author stats.likesReceived
```

---

### Get Pending Answers (Moderation Queue)
```
GET /api/answers/pending

Response: 200 OK
[
  {
    "id": "answer-uuid",
    "questionId": "q-uuid",
    "userId": "user-123",
    "type": "video",
    "status": "pending",
    "aiReview": {
      "approved": false,
      "feedback": "Needs review",
      "score": 0.58
    },
    "createdAt": "2026-03-22T10:15:00Z"
  },
  ...
]

Note: Returns only status="pending" answers
```

---

### Approve Answer (Admin)
```
POST /api/answers/answer-uuid/approve
Content-Type: application/json
x-admin-key: admin-secret-key-123

{}

Response: 200 OK
{
  "success": true,
  "message": "Answer approved",
  "answer": { ...answer object... }
}

Error: 403 Forbidden (wrong admin key)
Error: 404 Not Found (answer doesn't exist)
```

---

### Reject Answer (Admin)
```
POST /api/answers/answer-uuid/reject
Content-Type: application/json
x-admin-key: admin-secret-key-123

{
  "reason": "Spam or offensive content"
}

Response: 200 OK
{
  "success": true,
  "message": "Answer rejected",
  "reason": "Spam or offensive content"
}

Error: 403 Forbidden (wrong admin key)
Error: 404 Not Found (answer doesn't exist)
```

---

## AI Validation

### Validate Answer (Transcribe → Summarize → Fact-Check)
```
POST /api/ai/validate
Content-Type: application/json

{
  "type": "video",
  "contentUrl": "https://storage.example.com/video.mp4",
  "text": null
}

Response: 200 OK
{
  "approved": true,
  "shortSummary": "Fix TypeScript errors by checking type definitions",
  "fact": {
    "score": 0.78,
    "verdict": "likely_true"
  },
  "transcript": "Transcript for video...",
  "feedback": "Clear and likely accurate",
  "score": 0.78
}

Type Options:
  - "video": Transcribes → Summarizes → Fact-checks
  - "audio": Transcribes → Summarizes → Fact-checks
  - "text": Skips transcription, goes straight to summarize & fact-check

Approval Logic:
  approved = (fact.score > 0.6)

Production Stubs (Replace with Real APIs):
  - Transcription: OpenAI Whisper
  - Summarization: GPT-3.5-turbo
  - Fact-Check: Google Fact Check API
```

---

## Upload

### Upload Video/Audio File
```
POST /api/upload
Content-Type: multipart/form-data

[FormData]
video: <file: video.mp4>

Response: 200 OK
{
  "success": true,
  "filename": "1679566200000-video.mp4",
  "url": "http://localhost:5000/uploads/1679566200000-video.mp4",
  "size": 2048576,
  "duration": 5
}

Supported Formats:
  Video: MP4, WebM, MOV (≤ 5 seconds)
  Audio: MP3, WAV, M4A (≤ 5 seconds)

Storage: /backend/uploads/
Filename: ${Date.now()}-${originalname}

Usage:
  1. Upload file
  2. Get URL from response
  3. Use URL in POST /api/answers as contentUrl
```

---

## Admin Management

### Get All Users with Badges
```
GET /api/admin/users

Response: 200 OK
[
  {
    "id": "user-123",
    "username": "dev_expert",
    "email": "expert@example.com",
    "stats": {
      "answersGiven": 25,
      "likesReceived": 145,
      "questionsAsked": 8
    },
    "badgesEarned": 3,
    "badges": [
      { "id": "star", "name": "⭐ Star", "emoji": "⭐", "earnedAt": "2026-03-15T12:00:00Z" },
      { "id": "active", "name": "🚀 Active", "emoji": "🚀", "earnedAt": "2026-03-18T14:30:00Z" },
      { "id": "beta_tester", "name": "🧪 Beta Tester", "emoji": "🧪", "awardedBy": "admin", "earnedAt": "2026-03-22T09:00:00Z" }
    ],
    "createdAt": "2026-01-15T10:00:00Z"
  },
  ...
]
```

---

### Get User Badge Status
```
GET /api/admin/users/user-uuid/badges

Response: 200 OK
{
  "user": {
    "id": "user-123",
    "username": "dev_expert",
    "email": "expert@example.com",
    "stats": {
      "answersGiven": 25,
      "likesReceived": 145,
      "questionsAsked": 8
    },
    "followers": 450
  },
  "earned": [
    {
      "id": "star",
      "name": "⭐ Star",
      "description": "Received 50+ likes",
      "emoji": "⭐",
      "earnedAt": "2026-03-15T12:00:00Z"
    },
    ...
  ],
  "unearned": [
    {
      "id": "vip",
      "name": "👑 VIP",
      "description": "Received 500+ total views",
      "emoji": "👑",
      "progress": 0.62,
      "progressText": "310 / 500 views"
    },
    ...
  ],
  "answerCount": 25,
  "totalViews": 310,
  "totalLikes": 145
}
```

---

### Get All Badge Definitions
```
GET /api/admin/badges

Response: 200 OK
[
  {
    "id": "star",
    "name": "⭐ Star",
    "description": "Received 50+ likes",
    "emoji": "⭐",
    "category": "engagement",
    "criteria": { "likesReceived": 50 },
    "order": 1
  },
  {
    "id": "active",
    "name": "🚀 Active",
    "description": "Answered 20+ questions",
    "emoji": "🚀",
    "category": "contributor",
    "criteria": { "answersGiven": 20 },
    "order": 2
  },
  ... (8 total badges)
]

All 8 Badges:
  1. ⭐ Star (50+ likes)
  2. 🚀 Active (20+ answers)
  3. 👑 VIP (500+ views)
  4. ⚡ Rapid Fire (5+ answers in 1 day)
  5. 🎯 Perfect Score (10+ 100% AI approved)
  6. 🌟 Influencer (1000+ followers)
  7. 🧪 Beta Tester (manual award)
  8. 🎓 Expert (100+ high-quality)
```

---

### Get Badge Statistics
```
GET /api/admin/badges/stats

Response: 200 OK
{
  "stats": [
    {
      "badgeId": "star",
      "badgeName": "⭐ Star",
      "usersWithBadge": 23,
      "percentageOfUsers": 46
    },
    {
      "badgeId": "active",
      "badgeName": "🚀 Active",
      "usersWithBadge": 15,
      "percentageOfUsers": 30
    },
    ...
  ],
  "totalUsers": 50,
  "totalBadgesAwarded": 102
}
```

---

### Award Badge to User (Admin)
```
POST /api/admin/badges/award
Content-Type: application/json
x-admin-key: admin-secret-key-123

{
  "userId": "user-123",
  "badgeId": "beta_tester"
}

Response: 200 OK
{
  "success": true,
  "message": "Awarded 🧪 Beta Tester to dev_expert",
  "badge": {
    "id": "beta_tester",
    "name": "🧪 Beta Tester",
    "emoji": "🧪",
    "earnedAt": "2026-03-22T14:30:00Z",
    "awardedBy": "admin"
  }
}

Error: 403 Forbidden (wrong admin key)
Error: 404 Not Found (user or badge not found)
Error: 400 Bad Request (user already has badge)
```

---

### Revoke Badge from User (Admin)
```
POST /api/admin/badges/revoke
Content-Type: application/json
x-admin-key: admin-secret-key-123

{
  "userId": "user-123",
  "badgeId": "beta_tester"
}

Response: 200 OK
{
  "success": true,
  "message": "Revoked 🧪 Beta Tester from dev_expert"
}

Error: 403 Forbidden (wrong admin key)
Error: 404 Not Found (user or badge not found)
```

---

### Force Badge Check (Admin)
```
POST /api/admin/users/user-uuid/check-badges
Content-Type: application/json
x-admin-key: admin-secret-key-123

{}

Response: 200 OK
{
  "success": true,
  "message": "Checked badges for user-123",
  "newBadgesUnlocked": [
    {
      "id": "vip",
      "name": "👑 VIP",
      "emoji": "👑"
    }
  ]
}

Note: Recalculates all badge criteria and unlocks any that now qualify
```

---

### Get Leaderboard (Top Badge Users)
```
GET /api/admin/leaderboard

Response: 200 OK
[
  {
    "rank": 1,
    "userId": "user-123",
    "username": "dev_expert",
    "badgeCount": 7,
    "badges": [
      { "id": "star", "name": "⭐ Star", "emoji": "⭐" },
      { "id": "active", "name": "🚀 Active", "emoji": "🚀" },
      ...
    ]
  },
  {
    "rank": 2,
    "userId": "user-456",
    "username": "health_guru",
    "badgeCount": 5,
    "badges": [...]
  },
  ...
]

Note: Returns top 20 users sorted by badge count descending
```

---

## Comments & Videos

### Endpoints (Stubs - Ready for Implementation)
```
GET  /api/comments
POST /api/comments
GET  /api/comments/:answerId
DELETE /api/comments/:commentId

GET  /api/videos
POST /api/videos
GET  /api/videos/:videoId
DELETE /api/videos/:videoId
```

---

## Headers & Authentication

### All Admin Endpoints Require
```
x-admin-key: admin-secret-key-123
```

**Production:** Replace with JWT Authorization header
```
Authorization: Bearer <jwt-token>
```

---

## Error Responses

### Standard Error Format
```json
{
  "error": "Error description"
}
```

### Common Errors

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Missing required fields | Incomplete request body |
| 400 | Question too long | Text exceeds 200 chars |
| 400 | Text too long | Answer exceeds 70 chars |
| 400 | Invalid interaction type | Not "like", "view", or "save" |
| 403 | Unauthorized | Wrong/missing admin key |
| 404 | Question not found | Question ID doesn't exist |
| 404 | Answer not found | Answer ID doesn't exist |
| 404 | User not found | User ID doesn't exist |
| 500 | Server error | Unexpected error |

---

## Quick Examples

### Full User Flow
```
1. POST /api/questions (create question)
2. POST /api/upload (upload video)
3. POST /api/answers (create answer with video URL)
4. POST /api/answers/:id/interact (like reply)
5. GET /api/questions/feed (get FYP)
```

### Admin Flow
```
1. GET /api/admin/users (see all users)
2. GET /api/admin/users/:userId/badges (see badge progress)
3. POST /api/admin/users/:userId/check-badges (unlock if ready)
4. POST /api/admin/badges/award (award manually)
5. GET /api/admin/leaderboard (see top users)
```

### Moderation Flow
```
1. GET /api/answers/pending (queue)
2. POST /api/answers/:id/approve (approve)
   OR
   POST /api/answers/:id/reject (reject)
```

---

**Total Endpoints:** 30+  
**Authentication:** Mock key (replace with JWT)  
**Database:** In-memory (replace with PostgreSQL)  
**AI Services:** Stubs (replace with real APIs)  

Last Updated: March 22, 2026
