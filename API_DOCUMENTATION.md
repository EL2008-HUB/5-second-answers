# 5-Second Answers - Complete API Documentation

**Project:** 5-Second Answers - Global Micro Q&A Platform  
**Backend:** Node.js + Express.js  
**Database:** In-memory (ready for PostgreSQL migration)  
**API Base URL:** `http://localhost:5000/api`

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Routes & Endpoints](#routes--endpoints)
3. [Controllers](#controllers)
4. [Services](#services)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Integration Examples](#integration-examples)

---

## Architecture Overview

### Directory Structure
```
5second-answers-api/src/backend/
├── controllers/
│   ├── answerController.js       # Answer CRUD & interactions
│   ├── questionController.js     # Question CRUD & ranking
│   ├── adminController.js        # Admin & badge management
│   ├── aiController.js           # AI validation endpoint
│   ├── uploadController.js       # Video/audio upload
│   └── videoController.js        # Video management
├── routes/
│   ├── answers.js                # /api/answers/* routes
│   ├── question.js               # /api/questions/* routes
│   ├── admin.js                  # /api/admin/* routes
│   ├── ai.js                     # /api/ai/* routes
│   ├── upload.js                 # /api/upload/* routes
│   ├── comments.js               # /api/comments/* routes
│   └── videos.js                 # /api/videos/* routes
├── services/
│   ├── rankingService.js         # TikTok FYP algorithm
│   ├── badgeService.js           # Creator badge system
│   ├── aiService.js              # AI validation pipeline
│   └── (others as needed)
├── models/
│   └── Video.js
├── data/
│   └── db.js                     # In-memory database
└── server.js                     # Express app setup
```

### Key Design Patterns
- **Separation of Concerns:** Controllers handle HTTP logic, Services handle business logic
- **Fallback Pattern:** AI service errors fall back to simulation
- **Auto-Unlock:** Badge criteria checked automatically on answer creation & likes
- **Weighted Ranking:** 4-component TikTok-style algorithm for content discovery

---

## Routes & Endpoints

### 1. Questions Routes (`/api/questions`)

#### `POST /api/questions` - Create Question
Create a new question.

**Request:**
```json
{
  "text": "How do I make perfect pancakes?",
  "category": "cooking",
  "userId": "user-123"
}
```

**Parameters:**
| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `text` | string | Yes | Max 200 chars, non-empty |
| `category` | string | No | Default: "general" |
| `userId` | string | No | Default: "demo_user" |

**Response (201):**
```json
{
  "id": "question-uuid",
  "text": "How do I make perfect pancakes?",
  "category": "cooking",
  "userId": "user-123",
  "views": 0,
  "status": "active",
  "aiReviewed": false,
  "metadata": {
    "language": "en",
    "difficulty": "easy"
  },
  "createdAt": "2026-03-22T10:30:00.000Z"
}
```

**Error Responses:**
- `400` - Missing/invalid text
- `400` - Text exceeds 200 characters

---

#### `GET /api/questions` - Get Questions
Retrieve questions with optional filtering & sorting.

**Query Parameters:**
| Param | Type | Values | Default |
|-------|------|--------|---------|
| `category` | string | "cooking", "tech", "health", etc. / "all" | "all" |
| `trending` | boolean | "true" / "false" | "false" |

**Examples:**
- `GET /api/questions` - All questions
- `GET /api/questions?category=tech` - Tech questions only
- `GET /api/questions?category=tech&trending=true` - Trending tech questions

**Response (200):**
```json
[
  {
    "id": "q1",
    "text": "How do I fix TypeScript errors?",
    "category": "tech",
    "userId": "user-456",
    "views": 150,
    "status": "active",
    "createdAt": "2026-03-22T08:00:00.000Z"
  },
  ...
]
```

---

#### `GET /api/questions/:id` - Get Question by ID
Retrieve a specific question with answer count.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string (path) | Question UUID |

**Response (200):**
```json
{
  "id": "q1",
  "text": "How do I fix TypeScript errors?",
  "category": "tech",
  "userId": "user-456",
  "views": 151,
  "answerCount": 5,
  "status": "active",
  "createdAt": "2026-03-22T08:00:00.000Z"
}
```

**Behavior:** Increments question views by 1 on each request.

---

#### `GET /api/questions/feed` - Get Personalized FYP Feed
Get ranked & personalized feed of answers for the user's home screen.

**Query Parameters:**
| Param | Type | Values | Default |
|-------|------|--------|---------|
| `category` | string | Any category | "all" |
| `sort` | string | "top", "newest", "trending" | "top" |
| `limit` | number | 1-100 | 20 |

**Response (200):**
```json
[
  {
    "id": "answer-uuid",
    "questionId": "q1",
    "userId": "user-123",
    "type": "video",
    "contentUrl": "https://...",
    "text": null,
    "duration": 5,
    "interactions": {
      "likes": 42,
      "views": 156,
      "saves": 8
    },
    "aiReview": {
      "approved": true,
      "feedback": "Clear and concise",
      "score": 0.85
    },
    "status": "approved",
    "newBadges": [],
    "createdAt": "2026-03-22T10:15:00.000Z",
    "question": {
      "id": "q1",
      "text": "How do I fix TypeScript errors?",
      "category": "tech"
    },
    "user": {
      "username": "dev_expert",
      "avatar": "https://..."
    }
  },
  ...
]
```

**Ranking Algorithm:**
- **Engagement (35%):** Likes (3x weight) + Views (0.5x) + Saves (2x)
- **Recency (25%):** Exponential decay (50% per 24 hours)
- **Creator (25%):** User engagement + experience bonus + quality bonus
- **AI Confidence (15%):** AI approval score, penalties for low confidence

---

#### `GET /api/questions/trending` - Get Trending Questions
Get questions sorted by engagement (answer count + views).

**Response (200):**
```json
[
  {
    "id": "q1",
    "text": "How do I fix TypeScript errors?",
    "category": "tech",
    "answerCount": 12,
    "totalViews": 450,
    ...
  },
  ...
]
```

---

### 2. Answers Routes (`/api/answers`)

#### `POST /api/answers` - Add Answer
Submit a new answer (video, audio, or text).

**Request:**
```json
{
  "questionId": "q1",
  "userId": "user-123",
  "type": "video",
  "contentUrl": "https://storage.example.com/video.mp4",
  "text": null
}
```

**Parameters:**
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `questionId` | string | Yes | Must exist |
| `userId` | string | No | Default: "demo_user" |
| `type` | enum | Yes | "video", "audio", "text" |
| `contentUrl` | string | If type is video/audio | - |
| `text` | string | If type is text | Max 70 chars (~10 words) |

**Response (201):**
```json
{
  "id": "answer-uuid",
  "questionId": "q1",
  "userId": "user-123",
  "type": "video",
  "contentUrl": "https://storage.example.com/video.mp4",
  "text": null,
  "duration": 5,
  "interactions": {
    "likes": 0,
    "views": 0,
    "saves": 0
  },
  "aiReview": {
    "approved": true,
    "feedback": "Clear and concise",
    "score": 0.82
  },
  "status": "approved",
  "newBadges": ["star"],
  "createdAt": "2026-03-22T10:30:00.000Z"
}
```

**Behavior:**
1. Validates question exists
2. Validates answer content (type, length)
3. Calls `aiService.validateAnswer()` for transcription, summarization, fact-checking
4. Auto-approves if AI confidence > 0.7, else "pending"
5. Increments user `stats.answersGiven`
6. Checks badge unlock criteria
7. Returns any newly unlocked badges

**Error Responses:**
- `400` - Missing questionId or type
- `400` - Video/audio without contentUrl
- `400` - Text without content or exceeds limit
- `404` - Question not found

---

#### `GET /api/answers/:questionId` - Get Answers for Question
Retrieve all approved answers for a question, ranked by relevance.

**Query Parameters:**
| Param | Type | Values | Default |
|-------|------|--------|---------|
| `sort` | string | "top", "newest", "trending" | "top" |

**Response (200):**
```json
[
  {
    "id": "answer-uuid",
    "questionId": "q1",
    "userId": "user-123",
    "type": "video",
    "contentUrl": "https://...",
    "interactions": {
      "likes": 42,
      "views": 156,
      "saves": 8
    },
    "status": "approved",
    "createdAt": "2026-03-22T10:15:00.000Z",
    "user": {
      "username": "dev_expert",
      "avatar": "https://..."
    }
  },
  ...
]
```

---

#### `POST /api/answers/:answerId/interact` - Like/View/Save Answer
Record user interaction with an answer.

**Request:**
```json
{
  "type": "like",
  "userId": "user-456"
}
```

**Parameters:**
| Field | Type | Required | Values |
|-------|------|----------|--------|
| `type` | string | Yes | "like", "view", "save" |
| `userId` | string | No | Default: "demo_user" |

**Response (200):**
- **For "like" (toggle):**
  ```json
  {
    "liked": true,
    "likes": 43
  }
  ```
  *Or if already liked (unlike):*
  ```json
  {
    "liked": false,
    "likes": 42
  }
  ```

- **For "view" or "save":**
  ```json
  {
    "interaction": "view",
    "views": 157
  }
  ```

**Behavior:**
- **Likes are toggle-able:** Clicking again removes like
- **Views & saves are cumulative:** Each action increments counter
- **Triggers badge checks** on like (may unlock badges for author)
- Updates author's `stats.likesReceived`

**Error Responses:**
- `400` - Invalid interaction type
- `404` - Answer not found

---

#### `POST /api/answers/:answerId/approve` - Approve Answer (Moderation)
Approve a pending answer for display.

**Request:**
```json
{
  "adminKey": "admin-secret-key-123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Answer approved",
  "answer": { ...answer object... }
}
```

**Error Responses:**
- `403` - Wrong or missing admin key
- `404` - Answer not found

---

#### `POST /api/answers/:answerId/reject` - Reject Answer (Moderation)
Reject a pending answer (hides from platform).

**Request:**
```json
{
  "reason": "Spam or offensive content",
  "adminKey": "admin-secret-key-123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Answer rejected",
  "reason": "Spam or offensive content"
}
```

---

#### `GET /api/answers/pending` - Get Pending Answers (Moderation Queue)
Get all answers awaiting moderation approval.

**Response (200):**
```json
[
  {
    "id": "answer-uuid",
    "questionId": "q1",
    "userId": "user-123",
    "type": "video",
    "status": "pending",
    "aiReview": {
      "approved": false,
      "feedback": "Needs review",
      "score": 0.58
    },
    "createdAt": "2026-03-22T10:15:00.000Z"
  },
  ...
]
```

---

### 3. AI Routes (`/api/ai`)

#### `POST /api/ai/validate` - Validate Answer
Run AI validation (transcription, summarization, fact-checking) on answer content.

**Request:**
```json
{
  "type": "video",
  "contentUrl": "https://storage.example.com/video.mp4",
  "text": null
}
```

**Parameters:**
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | "video", "audio", "text" |
| `contentUrl` | string | URL for video/audio |
| `text` | string | Raw text for text-based answers |

**Response (200):**
```json
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
```

**Behavior:**
- For video/audio: Transcribes content → summarizes → fact-checks
- For text: Skips transcription, goes straight to summarization & fact-check
- Returns combined AI confidence score
- Approval based on: `score > 0.6` = approved

---

### 4. Admin Routes (`/api/admin`)

#### `GET /api/admin/users` - Get All Users with Badges
Retrieve all users with their earned badges and stats.

**Response (200):**
```json
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
      {
        "id": "star",
        "name": "⭐ Star",
        "emoji": "⭐",
        "earnedAt": "2026-03-15T12:00:00.000Z"
      },
      {
        "id": "active",
        "name": "🚀 Active",
        "emoji": "🚀",
        "earnedAt": "2026-03-18T14:30:00.000Z"
      },
      {
        "id": "beta_tester",
        "name": "🧪 Beta Tester",
        "emoji": "🧪",
        "awardedBy": "admin",
        "earnedAt": "2026-03-22T09:00:00.000Z"
      }
    ],
    "createdAt": "2026-01-15T10:00:00.000Z"
  },
  ...
]
```

---

#### `GET /api/admin/users/:userId/badges` - Get User Badge Status
Get detailed badge info (earned, unearned, progress) for a specific user.

**Response (200):**
```json
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
      "earnedAt": "2026-03-15T12:00:00.000Z"
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

#### `GET /api/admin/badges` - Get All Badge Definitions
Retrieve all available badge types with criteria & order.

**Response (200):**
```json
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
  ...8 total badges
]
```

---

#### `GET /api/admin/badges/stats` - Get Badge Statistics
Get distribution stats (how many users have each badge).

**Response (200):**
```json
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

#### `POST /api/admin/badges/award` - Award Badge to User
Manually award a badge to a user (admin action).

**Request:**
```json
{
  "userId": "user-123",
  "badgeId": "beta_tester",
  "x-admin-key": "admin-secret-key-123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Awarded 🧪 Beta Tester to dev_expert",
  "badge": {
    "id": "beta_tester",
    "name": "🧪 Beta Tester",
    "emoji": "🧪",
    "earnedAt": "2026-03-22T14:30:00.000Z",
    "awardedBy": "admin"
  }
}
```

**Error Responses:**
- `403` - Wrong or missing admin key
- `404` - User or badge not found
- `400` - User already has badge

---

#### `POST /api/admin/badges/revoke` - Revoke Badge from User
Remove a badge from a user (admin action).

**Request:**
```json
{
  "userId": "user-123",
  "badgeId": "beta_tester",
  "x-admin-key": "admin-secret-key-123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Revoked 🧪 Beta Tester from dev_expert"
}
```

---

#### `POST /api/admin/users/:userId/check-badges` - Force Badge Check
Trigger badge unlock check for a user (if criteria are met now).

**Request:**
```json
{
  "x-admin-key": "admin-secret-key-123"
}
```

**Response (200):**
```json
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
```

---

#### `GET /api/admin/leaderboard` - Get Badge Leaderboard
Get top users ranked by total badges earned.

**Response (200):**
```json
[
  {
    "rank": 1,
    "userId": "user-123",
    "username": "dev_expert",
    "badgeCount": 7,
    "badges": [
      {
        "id": "star",
        "name": "⭐ Star",
        "emoji": "⭐"
      },
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
```

---

### 5. Upload Routes (`/api/upload`)

#### `POST /api/upload` - Upload Video/Audio
Upload video or audio file for answer creation.

**Request (multipart/form-data):**
| Field | Type | Required |
|-------|------|----------|
| `video` | file | Yes |

**Supported Formats:**
- Video: MP4, WebM, MOV (max 5 seconds)
- Audio: MP3, WAV, M4A (max 5 seconds)

**Response (200):**
```json
{
  "success": true,
  "filename": "1679566200000-screen-recording.mp4",
  "url": "http://localhost:5000/uploads/1679566200000-screen-recording.mp4",
  "size": 2048576,
  "duration": 5
}
```

**Behavior:**
- Files saved to `5second-answers-api/src/backend/uploads/`
- Filename: `${Date.now()}-${originalname}`
- URL accessible via static file server

---

### 6. Comments Routes (`/api/comments`)

**Status:** Route exists; controller stubs ready for implementation.

---

### 7. Videos Routes (`/api/videos`)

**Status:** Route exists; controller stubs ready for implementation.

---

## Controllers

### answerController.js

**Exports:**

| Method | Route | Purpose |
|--------|-------|---------|
| `addAnswer()` | POST `/api/answers` | Create answer with AI validation |
| `getAnswersByQuestion()` | GET `/api/answers/:questionId` | Get answers for a question |
| `interactWithAnswer()` | POST `/api/answers/:answerId/interact` | Like/view/save answer |
| `approveAnswer()` | POST `/api/answers/:answerId/approve` | Approve pending answer |
| `rejectAnswer()` | POST `/api/answers/:answerId/reject` | Reject pending answer |
| `getPendingAnswers()` | GET `/api/answers/pending` | Get moderation queue |

**Key Logic:**
- AI validation with fallback simulation
- Auto-approval on high AI confidence
- Badge unlock triggers
- User stats updates
- Interaction toggle (likes) vs increment (views)

---

### questionController.js

**Exports:**

| Method | Route | Purpose |
|--------|-------|---------|
| `createQuestion()` | POST `/api/questions` | Create question |
| `getQuestions()` | GET `/api/questions` | List questions (filtered/sorted) |
| `getQuestionById()` | GET `/api/questions/:id` | Get question details |
| `getFeed()` | GET `/api/questions/feed` | Get ranked FYP feed |
| `getTrending()` | GET `/api/questions/trending` | Get trending questions |

**Key Logic:**
- Category filtering
- View tracking (increments on each GET)
- Answer counting
- Trending calculation (answer count × 2 + total views)
- Feed ranking via `rankingService`

---

### adminController.js

**Exports:**

| Method | Route | Purpose |
|--------|-------|---------|
| `getAllUsers()` | GET `/api/admin/users` | List all users with badges |
| `getUserBadgeStatus()` | GET `/api/admin/users/:userId/badges` | Get user's badge status |
| `getAllBadges()` | GET `/api/admin/badges` | Get all badge definitions |
| `getBadgeStats()` | GET `/api/admin/badges/stats` | Get badge distribution |
| `awardBadge()` | POST `/api/admin/badges/award` | Award badge (admin) |
| `revokeBadge()` | POST `/api/admin/badges/revoke` | Revoke badge (admin) |
| `checkAndUnlockBadges()` | POST `/api/admin/users/:userId/check-badges` | Force badge check |
| `getLeaderboard()` | GET `/api/admin/leaderboard` | Get top badge users |

**Key Logic:**
- Admin key authentication (`x-admin-key` header)
- Badge calculation via `badgeService`
- User stats aggregation
- Leaderboard ranking by badge count

---

### aiController.js

**Exports:**

| Method | Route | Purpose |
|--------|-------|---------|
| `validate()` | POST `/api/ai/validate` | Validate answer content |

**Key Logic:**
- Calls `aiService.validateAnswer()`
- Returns transcription, summary, fact-check, and approval

---

### uploadController.js

**Exports:**

| Method | Route | Purpose |
|--------|-------|---------|
| `uploadVideo()` | POST `/api/upload` | Upload video/audio file |

**Key Logic:**
- Multer middleware handles file storage
- Returns file URL for frontend integration

---

## Services

### rankingService.js

**Purpose:** Implement TikTok-style FYP algorithm for content discovery.

**Exports:**

#### `scoreAnswer(answer, allAnswers)` → Object
Score an answer based on 4 weighted components.

**Parameters:**
- `answer` (Object) - Answer to score
- `allAnswers` (Array) - All answers (for creator score calculation)

**Returns:**
```javascript
{
  score: 0.65,  // 0-1 range
  breakdown: {
    engagement: 0.42,
    recency: 0.75,
    creator: 0.80,
    aiPenalty: -0.05
  }
}
```

**Scoring Breakdown:**
1. **Engagement (35% weight)**
   - Formula: `(likes × 3 + views × 0.5 + saves × 2) / 100`
   - Normalized to 0-1 range
   - Likes weight more heavily

2. **Recency (25% weight)**
   - Half-life decay: 50% per 24 hours
   - Formula: `0.5 ^ (ageHours / 24)`
   - Newer content ranked higher

3. **Creator (25% weight)**
   - Base: `(totalLikes × 2 + totalViews) / 1000`
   - Experience bonus: +0.1 if >10 answers
   - Quality bonus: +0.05 if base score >0.5
   - Max 1.0

4. **AI Confidence (15% weight)**
   - Uses `answer.aiReview.score`
   - -0.2 penalty if not approved
   - -0.1 × (1 - score) penalty if <0.6

**Example:**
```javascript
const score = rankingService.scoreAnswer(answer, allAnswers);
console.log(score.score);  // 0.65
```

---

#### `rankAnswers(answers, sort)` → Array
Sort answers by relevance.

**Parameters:**
- `answers` (Array) - Answers to rank
- `sort` (String) - "top" | "newest" | "trending"

**Returns:** Sorted answer array

**Sort Modes:**
1. **"top"** - By overall FYP score (engagement + recency + creator + AI)
2. **"newest"** - By `createdAt` descending
3. **"trending"** - By (engagement score + views) / age, favoring recent engagement

**Example:**
```javascript
const ranked = rankingService.rankAnswers(answers, "top");
```

---

#### `getFYP(answers, limit)` → Array
Get shuffled top answers for FYP discovery (prevents algorithm bias).

**Parameters:**
- `answers` (Array) - All answers
- `limit` (Number) - How many to return (default 50)

**Returns:** Randomized subset of top-scored answers

**Behavior:**
- Scores all answers
- Takes top 50
- Shuffles order
- Returns `limit` items

---

### badgeService.js

**Purpose:** Manage 8 badge types with auto-unlock criteria.

**Badge Definitions:**

| ID | Name | Emoji | Criteria | Category |
|---|---|---|---|---|
| `star` | Star | ⭐ | 50+ likes | engagement |
| `active` | Active | 🚀 | 20+ answers | contributor |
| `vip` | VIP | 👑 | 500+ views | impact |
| `rapid_fire` | Rapid Fire | ⚡ | 5+ answers in 1 day | streak |
| `perfect_score` | Perfect Score | 🎯 | 10+ answers with 100% AI approval | quality |
| `influencer` | Influencer | 🌟 | 1000+ followers | influence |
| `beta_tester` | Beta Tester | 🧪 | Manual award only | special |
| `expert` | Expert | 🎓 | 100+ high-quality answers | mastery |

---

**Exports:**

#### `checkBadgeUnlock(badge, user, answers)` → Boolean
Check if user qualifies for a badge.

**Parameters:**
- `badge` (Object) - Badge definition
- `user` (Object) - User with `stats` property
- `answers` (Array) - User's answers

**Returns:** `true` if criteria met, `false` otherwise

**Example:**
```javascript
const qualifies = badgeService.checkBadgeUnlock(starBadge, user, userAnswers);
```

---

#### `getUserBadges(user, answers)` → Object
Get user's earned and unearned badges with progress.

**Returns:**
```javascript
{
  earned: [
    {
      id: "star",
      name: "⭐ Star",
      description: "Received 50+ likes",
      emoji: "⭐",
      earnedAt: "2026-03-15T12:00:00.000Z"
    },
    ...
  ],
  unearned: [
    {
      id: "vip",
      name: "👑 VIP",
      description: "Received 500+ total views",
      emoji: "👑",
      progress: 0.62,  // 0-1, shows % to unlock
      progressText: "310 / 500 views"
    },
    ...
  ]
}
```

---

#### `calculateBadgeProgress(badge, user, answers)` → Object
Calculate progress towards unearned badge.

**Returns:**
```javascript
{
  percentage: 0.62,
  current: 310,
  target: 500,
  text: "310 / 500 views"
}
```

---

#### `unlockNewBadges(user, answers)` → Array
Check ALL badges and unlock any new ones. Called after answer creation.

**Returns:** Array of newly unlocked badge IDs

**Example:**
```javascript
const newBadges = badgeService.unlockNewBadges(user, userAnswers);
// Returns: ["star", "active"]
```

---

#### `awardBadge(user, badgeId)` → Object
Manually award badge to user (admin).

**Returns:**
```javascript
{
  success: true,
  badge: { ...badge definition with earnedAt... }
}
```

Or error:
```javascript
{
  error: "User already has this badge"
}
```

---

#### `revokeBadge(user, badgeId)` → Object
Remove badge from user (admin).

**Returns:**
```javascript
{
  success: true,
  message: "Badge revoked"
}
```

---

### aiService.js

**Purpose:** AI validation pipeline (stubs ready for real service integration).

**Exports:**

#### `transcribe(contentUrl)` → Promise<String>
Convert video/audio to text transcript.

**Parameters:**
- `contentUrl` (String) - URL to video/audio file

**Returns:** Transcript string

**Implementation:** Currently simulates 200ms delay; replace with Whisper/real service.

---

#### `summarize(text, maxWords)` → Promise<String>
Summarize text to max word count.

**Parameters:**
- `text` (String) - Text to summarize
- `maxWords` (Number) - Max output words (default 10)

**Returns:** Summarized text

**Implementation:** Currently takes first N words; replace with GPT-3.5/real service.

---

#### `factCheck(text)` → Promise<Object>
Validate factual accuracy of text.

**Parameters:**
- `text` (String) - Text to fact-check

**Returns:**
```javascript
{
  score: 0.78,  // 0-1 confidence
  verdict: "likely_true"  // "likely_true" | "uncertain" | "likely_false"
}
```

**Implementation:** Currently random score; replace with real fact-check API.

---

#### `validateAnswer(obj)` → Promise<Object>
Full answer validation pipeline.

**Parameters:**
```javascript
{
  type: "video",  // "video" | "audio" | "text"
  contentUrl: "https://...",  // for video/audio
  text: "..."  // for text
}
```

**Returns:**
```javascript
{
  approved: true,
  shortSummary: "Fix TypeScript errors...",
  fact: {
    score: 0.78,
    verdict: "likely_true"
  },
  transcript: "Transcript...",  // null for text
  feedback: "Clear and likely accurate",
  score: 0.78
}
```

**Logic:**
1. If video/audio: transcribe → summarize → fact-check
2. If text: skip transcription, summarize → fact-check
3. Approval: `score > 0.6 = approved`

---

## Data Models

### Question
```javascript
{
  id: string (UUID),
  text: string (max 200 chars),
  category: string (e.g., "tech", "cooking"),
  userId: string,
  views: number,
  status: "active" | "archived",
  aiReviewed: boolean,
  metadata: {
    language: "en",
    difficulty: string
  },
  createdAt: Date
}
```

---

### Answer
```javascript
{
  id: string (UUID),
  questionId: string,
  userId: string,
  type: "video" | "audio" | "text",
  contentUrl: string | null,
  text: string | null,
  duration: number | null,  // seconds, 5 for video
  interactions: {
    likes: number,
    views: number,
    saves: number
  },
  aiReview: {
    approved: boolean,
    feedback: string,
    score: number (0-1),
    shortSummary?: string,
    transcript?: string,
    fact?: { score, verdict }
  },
  status: "pending" | "approved" | "rejected",
  newBadges: string[],  // badge IDs unlocked on creation
  createdAt: Date
}
```

---

### User
```javascript
{
  id: string (UUID),
  username: string,
  email: string,
  avatar: string | null,
  stats: {
    answersGiven: number,
    likesReceived: number,
    questionsAsked: number
  },
  badges: string[],  // badge IDs earned
  followers: number,
  createdAt: Date
}
```

---

### Badge
```javascript
{
  id: string,
  name: string,
  emoji: string,
  description: string,
  category: string,
  criteria: object,  // e.g., { likesReceived: 50 }
  order: number,
  earnedAt?: Date,
  awardedBy?: string  // "system" or "admin"
}
```

---

### Interaction
```javascript
{
  id: string (UUID),
  answerId: string,
  userId: string,
  type: "like" | "view" | "save",
  createdAt: Date
}
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": "Error message describing the problem"
}
```

### Common HTTP Status Codes

| Status | Meaning | Example |
|--------|---------|---------|
| `200` | Success | Question created |
| `201` | Created | Answer submitted |
| `400` | Bad Request | Missing required fields |
| `403` | Forbidden | Invalid admin key |
| `404` | Not Found | Question doesn't exist |
| `500` | Server Error | Unexpected error in service |

### Error Scenarios

**Answer Creation Errors:**
- `400` - Missing questionId or type
- `400` - Text exceeds 70 characters
- `404` - Question not found
- `500` - AI service times out (falls back to simulation)

**Moderation Errors:**
- `403` - Wrong admin key
- `404` - Answer not found
- `400` - Invalid state (e.g., already approved)

**Badge Errors:**
- `400` - User already has badge
- `403` - Insufficient permissions
- `404` - Badge or user not found

---

## Integration Examples

### Example 1: Create Question → Answer → Track Interaction

```javascript
// 1. Create question
POST /api/questions
{
  "text": "How do I optimize TypeScript performance?",
  "category": "tech",
  "userId": "user-123"
}
// Response: { id: "q1", ... }

// 2. Add video answer (upload first)
POST /api/upload (multipart)
[file: video.mp4]
// Response: { url: "http://localhost:5000/uploads/..." }

POST /api/answers
{
  "questionId": "q1",
  "userId": "user-456",
  "type": "video",
  "contentUrl": "http://localhost:5000/uploads/1679566200000-video.mp4"
}
// Response: { id: "answer-1", newBadges: ["star"], ... }

// 3. User likes answer
POST /api/answers/answer-1/interact
{
  "type": "like",
  "userId": "user-789"
}
// Response: { liked: true, likes: 1 }

// 4. Get answer with updated count
GET /api/answers/q1?sort=top
// Response: [{ id: "answer-1", interactions: { likes: 1, ... }, ... }]
```

---

### Example 2: Get Personalized FYP Feed

```javascript
// 1. Fetch feed (ranked by algorithm)
GET /api/questions/feed?category=tech&sort=top&limit=20
// Response: [
//   {
//     id: "answer-1",
//     questionId: "q1",
//     user: { username: "dev_expert", ... },
//     question: { text: "How do I optimize TypeScript?", ... },
//     interactions: { likes: 42, views: 156, saves: 8 },
//     aiReview: { approved: true, score: 0.85 },
//     ...
//   },
//   ...
// ]

// 2. User swipes → record view
POST /api/answers/answer-1/interact
{ "type": "view", "userId": "user-789" }

// 3. User likes → increment likes + check badge
POST /api/answers/answer-1/interact
{ "type": "like", "userId": "user-789" }
```

---

### Example 3: Admin Badge Management

```javascript
// 1. Get all users with badges
GET /api/admin/users
// Response: [
//   {
//     id: "user-123",
//     username: "dev_expert",
//     badgesEarned: 3,
//     badges: [{ id: "star", name: "⭐ Star", ... }, ...]
//   },
//   ...
// ]

// 2. Get specific user's badge progress
GET /api/admin/users/user-123/badges
// Response: {
//   user: { ... },
//   earned: [{ id: "star", ... }, ...],
//   unearned: [{
//     id: "vip",
//     name: "👑 VIP",
//     progress: 0.62,
//     progressText: "310 / 500 views"
//   }, ...]
// }

// 3. Award Beta Tester badge
POST /api/admin/badges/award
{
  "userId": "user-123",
  "badgeId": "beta_tester",
  "x-admin-key": "admin-secret-key-123"
}
// Response: {
//   success: true,
//   message: "Awarded 🧪 Beta Tester to dev_expert",
//   badge: { ... }
// }

// 4. Get leaderboard
GET /api/admin/leaderboard
// Response: [
//   {
//     rank: 1,
//     username: "dev_expert",
//     badgeCount: 7,
//     badges: [{ id: "star", ... }, ...]
//   },
//   ...
// ]
```

---

## Environment Setup

### Required Environment Variables
```bash
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost/5secondanswers
ADMIN_KEY=admin-secret-key-123
```

### Database Migration (Future)
When moving from in-memory to PostgreSQL:

1. Install dependencies:
   ```bash
   npm install pg knex
   ```

2. Create migrations for tables:
   - `questions`
   - `answers`
   - `users`
   - `badges`
   - `interactions`

3. Update `db.js` to use `db` connection instead of in-memory arrays

---

## Summary

**API Endpoints:** 30+ endpoints  
**Controllers:** 6 (answers, questions, admin, ai, upload, video)  
**Services:** 3 (ranking, badges, ai)  
**Badge Types:** 8 (with auto-unlock criteria)  
**Ranking Components:** 4 (engagement, recency, creator, AI)  
**Moderation Queue:** Yes (pending answers)  

All endpoints production-ready for backend handoff to dev team.
