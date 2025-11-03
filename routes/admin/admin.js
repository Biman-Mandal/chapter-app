const express = require("express");
const { body } = require("express-validator");
const adminController = require("../../controllers/AdminController");
const validateRequest = require("../../middleware/validateRequest");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

/**
 * @route POST /api/admin/login
 * @desc Admin login (Public)
 */
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password is required"),
    validateRequest,
  ],
  adminController.adminLogin
);

/**
 * @route POST /api/admin/create
 * @desc Create admin (Protected - Admin only)
 */
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
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    validateRequest,
  ],
  adminController.createAdmin
);

/**
 * @route GET /api/admin/profile
 * @desc Get admin profile (Protected)
 */
router.get("/profile", authMiddleware, adminController.getAdminProfile);

/**
 * @route PUT /api/admin/update-profile
 * @desc Update admin profile (Protected)
 */
router.put(
  "/update-profile",
  authMiddleware,
  [
    body("fullName").optional().isString().withMessage("Full name must be a string"),
    body("phone")
      .optional()
      .matches(/^\+?[0-9]{7,15}$/)
      .withMessage("Please provide a valid phone number"),
    body("profilePic").optional().isString().withMessage("Profile picture must be a string"),
    validateRequest,
  ],
  adminController.updateAdminProfile
);

/**
 * @route POST /api/admin/change-password
 * @desc Change admin password (Protected)
 */
router.post(
  "/change-password",
  authMiddleware,
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters long"),
    body("confirmPassword").notEmpty().withMessage("Confirm password is required"),
    validateRequest,
  ],
  adminController.changeAdminPassword
);

/**
 * @route GET /api/admin/stats
 * @desc Get dashboard statistics (Protected)
 */
router.get("/stats", authMiddleware, adminController.getAdminStats);

/**
 * @route GET /api/admin/users
 * @desc Get all users (Protected - Admin only)
 */
router.get("/users", authMiddleware, adminController.getAllUsers);

/**
 * @route POST /api/admin/deactivate-user
 * @desc Deactivate a user (Protected - Admin only)
 */
router.post(
  "/deactivate-user",
  authMiddleware,
  [body("userId").notEmpty().withMessage("User ID is required"), validateRequest],
  adminController.deactivateUser
);

module.exports = router;
