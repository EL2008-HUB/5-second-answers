const roomService = require("./roomService");

const emitRoomSnapshot = (io, roomId, snapshot) => {
  if (!snapshot) {
    return;
  }

  io.to(roomId).emit("room_state", snapshot);
  io.to(roomId).emit("presence_state", snapshot.presenceUsers || []);
  io.to(roomId).emit("typing_state", snapshot.typingUsers || []);
};

const initRoomSocket = async (io) => {
  await roomService.seedRoomsIfEmpty();

  io.on("connection", (socket) => {
    console.log("[Rooms] User connected:", socket.id);

    socket.on("join_room", async (payload = {}) => {
      try {
        const snapshot = await roomService.joinRoom({
          roomId: payload.roomId,
          socketId: socket.id,
          userId: payload.userId,
          username: payload.username,
        });

        socket.data.roomId = payload.roomId;
        socket.data.userId = payload.userId;
        socket.data.username = payload.username;

        socket.join(payload.roomId);
        socket.emit("room_state", snapshot);
        socket.emit("presence_state", snapshot.presenceUsers || []);
        socket.emit("typing_state", snapshot.typingUsers || []);
        io.to(payload.roomId).emit("user_joined", snapshot.users);
      } catch (error) {
        socket.emit("room_error", { message: error.message || "Failed to join room" });
      }
    });

    socket.on("submit_answer", async (payload = {}) => {
      try {
        const result = await roomService.addRoomAnswer({
          duration: payload.duration,
          mediaUrl: payload.mediaUrl,
          mimeType: payload.mimeType,
          roomId: payload.roomId,
          text: payload.text,
          type: payload.type,
          userId: payload.userId,
          username: payload.username,
        });

        io.to(payload.roomId).emit("new_answer", result.entry);
        emitRoomSnapshot(io, payload.roomId, result.room);
      } catch (error) {
        socket.emit("room_error", { message: error.message || "Failed to submit answer" });
      }
    });

    socket.on("typing_start", async (payload = {}) => {
      try {
        const snapshot = await roomService.updateTypingState({
          isTyping: true,
          roomId: payload.roomId,
          socketId: socket.id,
          userId: payload.userId,
          username: payload.username,
        });

        emitRoomSnapshot(io, payload.roomId, snapshot);
      } catch (error) {
        socket.emit("room_error", { message: error.message || "Failed to update typing state" });
      }
    });

    socket.on("typing_stop", async (payload = {}) => {
      try {
        const snapshot = await roomService.updateTypingState({
          isTyping: false,
          roomId: payload.roomId,
          socketId: socket.id,
          userId: payload.userId,
          username: payload.username,
        });

        emitRoomSnapshot(io, payload.roomId, snapshot);
      } catch (error) {
        socket.emit("room_error", { message: error.message || "Failed to update typing state" });
      }
    });

    socket.on("heartbeat", async (payload = {}) => {
      try {
        const snapshot = await roomService.touchParticipant({
          roomId: payload.roomId,
          socketId: socket.id,
          updateRoomActivity: false,
          userId: payload.userId,
          username: payload.username,
        });

        emitRoomSnapshot(io, payload.roomId, snapshot);
      } catch (error) {
        socket.emit("room_error", { message: error.message || "Failed to keep room alive" });
      }
    });

    socket.on("leave_room", async (payload = {}) => {
      const snapshot = await roomService.leaveRoom({
        roomId: payload.roomId,
        socketId: socket.id,
        userId: payload.userId,
      });

      socket.leave(payload.roomId);
      io.to(payload.roomId).emit("user_left", snapshot?.users || []);
      emitRoomSnapshot(io, payload.roomId, snapshot);
    });

    socket.on("disconnect", async () => {
      console.log("[Rooms] User disconnected:", socket.id);
      const updatedRooms = await roomService.removeSocketFromRooms(socket.id);

      updatedRooms.forEach((room) => {
        io.to(room.id).emit("user_left", room.users);
        emitRoomSnapshot(io, room.id, room);
      });
    });
  });
};

module.exports = {
  initRoomSocket,
};
