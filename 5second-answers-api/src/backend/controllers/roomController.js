const roomService = require("../services/roomService");

exports.listRooms = async (req, res) => {
  try {
    await roomService.seedRoomsIfEmpty();
    await roomService.cleanupIdleRooms();
    res.json({
      rooms: await roomService.listRooms(),
    });
  } catch (error) {
    console.error("List rooms error:", error);
    res.status(500).json({ error: "Failed to list rooms" });
  }
};

exports.createRoom = async (req, res) => {
  const { hostUserId, maxUsers, questionText, title, topic } = req.body || {};

  if (!title || !questionText) {
    return res.status(400).json({ error: "title and questionText are required" });
  }

  try {
    const room = await roomService.createRoom({
      hostUserId,
      maxUsers,
      questionText,
      title,
      topic,
    });

    res.status(201).json(room);
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ error: "Failed to create room" });
  }
};

exports.getRoom = async (req, res) => {
  try {
    const room = await roomService.getRoom(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(room);
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ error: "Failed to get room" });
  }
};

exports.getRoomByInviteCode = async (req, res) => {
  try {
    const room = await roomService.getRoomByInviteCode(req.params.inviteCode);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(room);
  } catch (error) {
    console.error("Get room by invite error:", error);
    res.status(500).json({ error: "Failed to get room" });
  }
};
