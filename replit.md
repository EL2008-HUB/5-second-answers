# 10-Second Answers · Shqipëri

## Rreth Projektit
Platformë gamifikuese e mikroinvolvimit Q&A në stilin TikTok/Quora, e fokusuar te komuniteti shqiptar.

## Arkitektura
- **Backend**: `5second-answers-api/` — Node.js + Express (JavaScript), port 5000
- **DB**: PostgreSQL (Replit built-in), Knex.js ORM
- **Frontend Dashboard**: `public/index.html` — HTML/CSS/JS i pastër, pa framework
- **Workflow**: `cd 5second-answers-api && npm run dev`

## Veçoritë Kryesore
- Pyetja e Ditës (QOD) me timer 10 sekondash + audio tick-tock
- Hot Takes Feed me swipe-style voting (Po/Jo)
- Opinion Battles me vote bars të animuara
- Renditja (Leaderboard) me filtrim sipas vendit (AL/XK/MK/Global)
- Dhoma Live me Socket.io
- Streak tracking me kalendarë vizual
- Sistemi i Arritjeve (Badges)
- XP toast + konfeti animations
- Share modal (native Web Share API)
- Krijtë Pyetje nga komuniteti

## Struktura e DB
Tabelat kryesore: `users`, `questions`, `answers`, `rooms`, `room_participants`,
`battles`, `battle_votes`, `quick_votes`, `reactions`, `answer_likes`,
`user_streaks`, `notifications`, `hashtags`, `badges`, `user_badges`, dhe 15+ tjera

## Endpointet API
- `GET /api/questions` — pyetjet (me filtrim lang, country, category)
- `GET /api/questions/daily` — pyetja e ditës
- `GET /api/gamification/leaderboard` — renditja
- `GET /api/rooms` — dhomat aktive
- `POST /api/questions` — krijo pyetje
- `POST /api/questions/:id/vote` — voto Po/Jo
- `POST /api/questions/:id/battle/vote` — voto në betejë
- `GET /health` — kontrollo gjendjen

## Gjuhët
Shqip (sq) si kryesore, anglisht (en) i mbështetur.

## Versionet e Kryesore
- v1.0 — Backend TypeScript (i humbur gjatë merge)
- v2.0 — Backend JS origjinal nga GitHub + dashboard i ri interaktiv
