const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/AuthController");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router();

// -------------------- Register --------------------
router.post(
  "/register",
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
  authController.register
);

// -------------------- Login --------------------
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password is required"),
    validateRequest,
  ],
  authController.login
);

// -------------------- Forgot Password (Send OTP) --------------------
router.post(
  "/forgot-password",
  [
    body("email").isEmail().withMessage("Valid email required"),
    validateRequest,
  ],
  authController.forgotPassword
);

// -------------------- Verify OTP & Reset Password --------------------
router.post(
  "/reset-password",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("otp").isNumeric().withMessage("OTP must be numeric"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    validateRequest,
  ],
  authController.verifyOtpAndReset
);

module.exports = router;
