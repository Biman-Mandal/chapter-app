const express = require("express");
const router = express.Router();
const questionController = require("../../controllers/admin/QuestionController");
const adminAuthMiddleware = require("../../middleware/adminAuthMiddleware");
const authMiddleware = require("../../middleware/authMiddleware"); // user auth for "my" endpoints
const upload = require("../../middleware/uploadMiddleware");

// Questions CRUD (existing)
router.get("/list", adminAuthMiddleware, questionController.questionList);
router.get("/:id", adminAuthMiddleware, questionController.getQuestion);
router.post("/create", adminAuthMiddleware, upload.array("optionFiles"), questionController.createQuestion);
router.put("/update/:id", adminAuthMiddleware, upload.array("optionFiles"), questionController.updateQuestion);
router.delete("/delete/:id", adminAuthMiddleware, questionController.deleteQuestion);

// Responses
router.get("/responses/list", adminAuthMiddleware, questionController.listResponses); // admin list with filters
router.get("/responses/:id", adminAuthMiddleware, questionController.getResponseById); // admin fetch single
router.get("/responses/user", adminAuthMiddleware, questionController.responsesByUser); // admin fetch by user (query userId)
router.delete("/responses/:id", adminAuthMiddleware, questionController.deleteResponse); // admin delete response

module.exports = router;