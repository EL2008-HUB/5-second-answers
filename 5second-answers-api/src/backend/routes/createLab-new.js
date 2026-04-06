const express = require("express");
const router = express.Router();
const controller = require("../controllers/createLabController-new");

// 🧪 CREATE LAB ROUTES
router.post("/", controller.createCreation);
router.get("/", controller.getCreations);
router.get("/:id", controller.getCreationById);
router.post("/:id/interact", controller.interactWithCreation);

// 💡 IDEA GENERATOR
router.get("/ideas/random", controller.getRandomIdea);

// 🎨 TEMPLATES & TOOLS
router.get("/templates", controller.getTemplates);
router.get("/stickers", controller.getStickers);

module.exports = router;
