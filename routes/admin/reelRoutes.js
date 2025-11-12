const express = require("express");
const router = express.Router();
const reelController = require("../../controllers/admin/ReelController");
const adminAuthMiddleware = require("../../middleware/adminAuthMiddleware");
const upload = require("../../middleware/uploadMiddleware");

// list and get (protected)
router.get("/list", adminAuthMiddleware, reelController.reelList);
router.get("/:id", adminAuthMiddleware, reelController.getReel);

// create - media file field name: 'media'
router.post("/create", adminAuthMiddleware, upload.single("media"), reelController.createReel);

// update (media optional)
router.put("/update/:id", adminAuthMiddleware, upload.single("media"), reelController.updateReel);

// delete
router.delete("/delete/:id", adminAuthMiddleware, reelController.deleteReel);

module.exports = router;