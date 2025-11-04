const express = require("express");
const router = express.Router();
const questionController = require("../../controllers/admin/QuestionController");
const adminAuthMiddleware = require("../../middleware/adminAuthMiddleware");
// Note: For submitResponse you may want a user auth middleware (e.g., authMiddleware).
// If you have a general auth middleware, replace below or add both as needed.

router.get("/list", adminAuthMiddleware, questionController.questionList);
router.get("/:id", adminAuthMiddleware, questionController.getQuestion);
router.post("/create", adminAuthMiddleware, questionController.createQuestion);
router.put("/update/:id", adminAuthMiddleware, questionController.updateQuestion);
router.delete("/delete/:id", adminAuthMiddleware, questionController.deleteQuestion);

// Admin-only: list responses
router.get("/responses/list", adminAuthMiddleware, questionController.listResponses);

// Public or authenticated users submit responses.
// If you have a user auth middleware, replace the anonymous handler with it.
router.post("/response", questionController.submitResponse);

module.exports = router;
