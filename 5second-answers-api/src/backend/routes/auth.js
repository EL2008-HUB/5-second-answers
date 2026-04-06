const express = require("express");
const controller = require("../controllers/authController");

const router = express.Router();

router.post("/signup", controller.signup);
router.post("/login", controller.login);
router.patch("/home-country", controller.updateHomeCountry);
router.get("/me", controller.me);

module.exports = router;
