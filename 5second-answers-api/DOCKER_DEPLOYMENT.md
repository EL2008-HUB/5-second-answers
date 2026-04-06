# Docker Deployment Guide

## Local Compose Setup

### 1. Create a local env file
```bash
cd 5second-answers-api
cp .env.docker .env.docker.local
```

Update these values in `.env.docker.local` before you start:
- `DB_PASSWORD`
- `GROQ_API_KEY`
- `NEMOTRON_API_KEY`
- `OPENROUTER_API_KEY`
- `GOOGLE_FACT_CHECK_API_KEY`
- `ADMIN_KEY`
- `RUN_DB_SEED` set to `true` only if you want demo data loaded on boot

### 2. Start PostgreSQL and the API
```bash
docker compose --env-file .env.docker.local up --build
```

What happens on startup:
- PostgreSQL starts on port `5432`
- The API starts on port `5000`
- Migrations run automatically
- Seeds run only when `RUN_DB_SEED=true`

### 3. Verify the services
```bash
curl http://localhost:5000/health
curl http://localhost:5000/api/questions
```

## Common Commands

Start in the background:
```bash
docker compose --env-file .env.docker.local up -d
```

Stop services:
```bash
docker compose down
```

Stop services and remove the database volume:
```bash
docker compose down -v
```

View API logs:
```bash
docker compose logs -f api
```

View database logs:
```bash
docker compose logs -f db
```

Run a seed manually:
```bash
docker compose exec api npm run db:seed
```

Run migrations manually:
```bash
docker compose exec api npm run db:migrate
```

## Production Notes

- Keep `RUN_DB_SEED=false` in production.
- Pass secrets at runtime through your host, CI, or a secrets manager.
- Do not bake `.env` files into the Docker image.
- Keep the uploads volume mounted or move uploads to object storage such as S3.
- Rotate any key that was previously exposed or committed.

## Troubleshooting

If port `5000` is already in use, change `HOST_PORT` in `.env.docker.local` and restart:
```bash
docker compose --env-file .env.docker.local up --build
```

If the API cannot reach PostgreSQL, confirm the database container is healthy:
```bash
docker compose ps
docker compose logs db
```

If you need a full reset:
```bash
docker compose down -v
docker compose --env-file .env.docker.local up --build
```
