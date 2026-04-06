# AI Routing Setup

This project is now prepared for a 3-layer AI stack.

Routing mode is now `team_escalation_locked`, not heuristic.

## Final stack

- `FAST` -> `Groq`
- `SMART` -> `Mixtral` via `OpenRouter`
- `BRAIN` -> `NVIDIA Nemotron Super`

## Routing logic

- `FAST tasks` -> always `Groq`
- `SMART tasks` -> always `Mixtral`
- `BRAIN tasks` -> always `Nemotron`
- `Fallbacks` are fixed by role and never chosen randomly

This means tasks do not jump between AI providers based on prompt length or wording anymore.
The provider is selected by `taskType`, with a fixed team flow when needed.

## Team flow

- User-facing answer -> `Groq`
- Better explanation or medium analysis -> `Mixtral`
- Deep reasoning, decisions, and news processing -> `Nemotron`

Most requests do not call all 3.
The stack escalates only when the task belongs to the next role.

The current intent is:

- `simple`: short questions and 1-2 sentence answers, fast frontend reactions
- `medium`: explanation, idea generation, light analysis
- `complex`: decisions, news analysis, deeper reasoning

## What you need to fill

Update `5second-answers-api/.env` with:

```env
GROQ_API_KEY=
OPENROUTER_API_KEY=
OPENROUTER_HTTP_REFERER=
OPENROUTER_APP_TITLE=
NEMOTRON_API_KEY=
```

Optional model overrides:

```env
GROQ_MODEL=llama-3.3-70b-versatile
OPENROUTER_SMART_MODEL=mistralai/mixtral-8x7b-instruct
OPENROUTER_MODEL_COMPLEX=mistralai/mixtral-8x22b-instruct
NEMOTRON_BASE_URL=https://integrate.api.nvidia.com/v1
NEMOTRON_BRAIN_MODEL=nvidia/nemotron-3-super-120b-a12b
AI_ROUTING_ENABLED=true
```

## Ready endpoints

- `GET /api/ai/health`
  Shows provider readiness, active model config, and sample routing previews.

- `POST /api/ai/route-preview`
  Lets you preview which provider/model will be chosen before making real AI calls.

Example body:

```json
{
  "taskType": "comment",
  "question": "A do e beje kete?",
  "answer": "Po, pse jo."
}
```

Another example:

```json
{
  "taskType": "news_question_generation",
  "title": "Breaking news: leaders debate a major new policy shift"
}
```

## Current task mapping

- `comment`, `comment_moderation`, `comment_reactions` -> `FAST`
- `assistant` -> `FAST` first
- `answer_validation`, `create_lab_ideas`, `sentiment`, `story_emotion`, `summarize` -> `SMART`
- `news_question_generation`, `news_reasoning`, `decision_support`, `deep_analysis` -> `BRAIN`

## Notes

- If a provider is unavailable, the service falls back to the next route automatically.
- Route previews now include `role`, `background`, and `fallbacks`.
- Logging is already enabled in the AI layer through `AI INPUT`, `AI OUTPUT`, and `[AI ROUTE]`.
