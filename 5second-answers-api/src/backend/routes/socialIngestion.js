const express = require("express");
const controller = require("../controllers/socialIngestionController");

const router = express.Router();

router.post("/import/:provider", controller.importPosts);
router.post("/webhook/:provider", controller.receiveWebhook);

module.exports = router;
