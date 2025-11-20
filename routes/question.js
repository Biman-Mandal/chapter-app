const express = require("express");
const router = express.Router();
const questionPublicController = require("../controllers/QuestionController");

// GET /api/questions/list
// Public endpoint used by frontend to fetch active questions.
// Optional Authorization: Bearer <token> to attach user's last answers if includeAnswered=true
router.get("/list", questionPublicController.list);

module.exports = router;