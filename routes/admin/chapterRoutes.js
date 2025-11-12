const express = require("express");
const router = express.Router();
const chapterController = require("../../controllers/admin/ChapterController");
const adminAuthMiddleware = require("../../middleware/adminAuthMiddleware");
const upload = require("../../middleware/uploadMiddleware");

// list and get
router.get("/list", adminAuthMiddleware, chapterController.chapterList);
router.get("/:id", adminAuthMiddleware, chapterController.getChapter);

// create - media file field name: 'media'
router.post("/create", adminAuthMiddleware, upload.single("media"), chapterController.createChapter);

// update (media optional)
router.put("/update/:id", adminAuthMiddleware, upload.single("media"), chapterController.updateChapter);

// delete
router.delete("/delete/:id", adminAuthMiddleware, chapterController.deleteChapter);

module.exports = router;