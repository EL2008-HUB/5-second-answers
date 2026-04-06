const express = require("express");
const controller = require("../controllers/roomController");

const router = express.Router();

router.get("/", controller.listRooms);
router.post("/", controller.createRoom);
router.get("/invite/:inviteCode", controller.getRoomByInviteCode);
router.get("/:roomId", controller.getRoom);

module.exports = router;
