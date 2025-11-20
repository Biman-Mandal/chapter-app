const express = require("express");
const { body } = require("express-validator");
const userController = require("../controllers/UserController");
const authMiddleware = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest"); // Adjust path
const ProgressController = require("../controllers/ProgressController");

const router = express.Router();

// Get Profile
router.get("/profile", authMiddleware, userController.getProfile);

// Update Profile
router.put(
  "/profile",
  authMiddleware,
  [
    body("fullName").optional().notEmpty().withMessage("Full name cannot be empty"),
    body("phone")
      .notEmpty()
      .withMessage("Phone number is required")
      .isNumeric()
      .withMessage("Phone number must contain only digits"),
    validateRequest,
  ],
  userController.updateProfile
);

router.post("/question/submit", userController.submitResponse);
router.get("/question/me", authMiddleware, userController.myResponses);


// POST /api/progress
// Body: { bookId, chapterId, playedSeconds, durationSeconds?, metadata?: { userIdentifier? } }
// Returns saved progress and guestIdentifier (if guest)
router.post("/chapter-progress", authMiddleware, ProgressController.record);

// GET /api/progress/book/:bookId
// Query: guestIdentifier (for guest) or Authorization Bearer for user
router.get("/book/:bookId",authMiddleware, ProgressController.bookProgress);

module.exports = router;