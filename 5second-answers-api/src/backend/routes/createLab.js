const express = require("express");
const router = express.Router();
const controller = require("../controllers/createLabController");

router.get("/", controller.getWorkspace);
router.post("/save-concept", controller.saveConcept);
router.post("/draft-history", controller.logDraftHistory);
router.delete("/:id", controller.deleteWorkspaceItem);

module.exports = router;
