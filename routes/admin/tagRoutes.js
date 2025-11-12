const express = require("express");
const router = express.Router();
const tagController = require("../../controllers/admin/TagController");
const adminAuthMiddleware = require("../../middleware/adminAuthMiddleware");

router.get("/list", adminAuthMiddleware, tagController.listTags);
router.post("/create", adminAuthMiddleware, tagController.createTag);
router.put("/update/:id", adminAuthMiddleware, tagController.updateTag);
router.delete("/delete/:id", adminAuthMiddleware, tagController.deleteTag);

module.exports = router;