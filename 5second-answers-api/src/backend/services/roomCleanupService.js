const roomService = require("./roomService");

let cleanupTimer = null;

const CLEANUP_INTERVAL_MS = Math.max(
  60 * 1000,
  Number(process.env.ROOM_CLEANUP_INTERVAL_MS || 5 * 60 * 1000)
);

const startRoomCleanupScheduler = (io) => {
  if (cleanupTimer) {
    return cleanupTimer;
  }

  cleanupTimer = setInterval(async () => {
    try {
      const expiredRooms = await roomService.cleanupIdleRooms();
      expiredRooms.forEach((room) => {
        io.to(room.id).emit("room_expired", {
          message: "Ky room u mbyll sepse qendroi idle per shume kohe.",
          roomId: room.id,
        });
      });

      if (expiredRooms.length) {
        console.log(`[Rooms] Expired ${expiredRooms.length} idle room(s)`);
      }
    } catch (error) {
      console.error("[Rooms] Cleanup failed:", error.message);
    }
  }, CLEANUP_INTERVAL_MS);

  console.log(`[Rooms] Cleanup scheduler active every ${Math.round(CLEANUP_INTERVAL_MS / 1000)}s`);
  return cleanupTimer;
};

module.exports = {
  startRoomCleanupScheduler,
};
