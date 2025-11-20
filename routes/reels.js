const express = require("express");
const router = express.Router();
const ReelController = require("../controllers/ReelController");

// Public endpoint: prioritize reels based on current user's chosenTags (if token provided),
// otherwise prioritize reels tagged "Reels". No other filters applied by default.
// GET /api/reels/tag-priority
router.get("/", ReelController.listByUserTags);

module.exports = router;