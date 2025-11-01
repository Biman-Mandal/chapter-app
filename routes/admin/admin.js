const express = require("express")
const { body } = require("express-validator")
const adminController = require("../../controllers/AdminController")
const validateRequest = require("../../middleware/validateRequest")
const authMiddleware = require("../../middleware/authMiddleware")

const router = express.Router()

// Admin Login (Public)
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password is required"),
    validateRequest,
  ],
  adminController.adminLogin,
)

// Create Admin (Protected - Admin only)
router.post(
  "/create",
  authMiddleware,
  [
    body("fullName").notEmpty().withMessage("Full name is required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("phone")
      .notEmpty()
      .withMessage("Phone number is required")
      .isNumeric()
      .withMessage("Phone number must contain only digits"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    validateRequest,
  ],
  adminController.createAdmin,
)

// Get Admin Profile (Protected)
router.get("/profile", authMiddleware, adminController.getAdminProfile)

// Get All Users (Protected - Admin only)
router.get("/users", authMiddleware, adminController.getAllUsers)

// Deactivate User (Protected - Admin only)
router.post(
  "/deactivate-user",
  authMiddleware,
  [body("userId").notEmpty().withMessage("User ID is required")],
  adminController.deactivateUser,
)

module.exports = router
