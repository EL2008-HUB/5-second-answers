# 🐳 Docker Quick Start - 5-Second Answers

## 1-Minute Setup

### Prerequisites
✅ Docker Desktop installed: https://www.docker.com/products/docker-desktop

### Copy-Paste Commands

```bash
# 1. Navigate to project
cd 5second-answers-api

# 2. Start everything
docker-compose up --build

# 3. In another terminal, test it
node run-api-tests.js
```

**Done!** 🎉

- API running at: `http://localhost:5000`
- Database running at: `localhost:5432`
- Logs visible in terminal (Ctrl+C to stop)

---

## Common Commands

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart
docker-compose restart

# Rebuild images
docker-compose up --build

# Delete everything (clean reset)
docker-compose down -v
```

---

## Troubleshooting in 10 Seconds

**Q: Port 5000 already in use**
```bash
docker-compose down
# Or use different port:
docker run -p 8000:5000 your-image
```

**Q: Database connection failed**
```bash
# Check status
docker-compose ps
# If not healthy, restart
docker-compose down && docker-compose up
```

**Q: Can't see output**
```bash
docker-compose logs api
```

**Q: Everything broken, start fresh**
```bash
docker-compose down -v
docker system prune -a
docker-compose up --build
```

---

## For Production

See [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for:
- Heroku deployment
- AWS ECS
- Google Cloud Run
- Docker Hub push
- CI/CD setup

---

**Stuck?** Check `DOCKER_DEPLOYMENT.md` for detailed guide
