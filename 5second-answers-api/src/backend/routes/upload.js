const express = require("express");
const multer = require("multer");
const path = require("path");
const { uploadMedia } = require("../controllers/uploadController");

const router = express.Router();

/* STORAGE */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

/* ROUTE */
router.post(
  "/",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "audio", maxCount: 1 },
    { name: "media", maxCount: 1 },
  ]),
  uploadMedia
);

module.exports = router;
