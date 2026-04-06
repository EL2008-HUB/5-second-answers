const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const { Server } = require("socket.io");
const { db } = require("./backend/data/db");

const videoRoutes = require("./backend/routes/videos");
const uploadRoutes = require("./backend/routes/upload");
const commentRoutes = require("./backend/routes/comments");
const authRoutes = require("./backend/routes/auth");
const questionRoutes = require("./backend/routes/question");
const answerRoutes = require("./backend/routes/answers");
const aiRoutes = require("./backend/routes/ai");
const adminRoutes = require("./backend/routes/admin");
const socialRoutes = require("./backend/routes/social");
const notificationRoutes = require("./backend/routes/notifications");
const createLabRoutes = require("./backend/routes/createLab-new");
const gamificationRoutes = require("./backend/routes/gamification");
const trendingRoutes = require("./backend/routes/trending");
const storyRoutes = require("./backend/routes/story");
const hashtagRoutes = require("./backend/routes/hashtags");
const socialIngestionRoutes = require("./backend/routes/socialIngestion");
const duetRoutes = require("./backend/routes/duets");
const referralRoutes = require("./backend/routes/referrals");
const roomRoutes = require("./backend/routes/rooms");
const { startNotificationScheduler } = require("./backend/services/notificationScheduler");
const { startRoomCleanupScheduler } = require("./backend/services/roomCleanupService");
const { initRoomSocket } = require("./backend/services/roomSocketService");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "backend", "uploads")));

app.get("/", (req, res) => {
  res.send("5-Second Answers API OK");
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

app.use("/api/videos", videoRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/answers", answerRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/create-lab", createLabRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/trending", trendingRoutes);
app.use("/api/story", storyRoutes);
app.use("/api/hashtags", hashtagRoutes);
app.use("/api/social-ingestion", socialIngestionRoutes);
app.use("/api/duets", duetRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/rooms", roomRoutes);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await db.migrate.latest();
    console.log("Database migrations are up to date");
    startNotificationScheduler();
    await initRoomSocket(io);
    startRoomCleanupScheduler(io);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`API running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start API:", error);
    process.exit(1);
  }
};

startServer();

