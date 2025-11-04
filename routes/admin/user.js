const express = require("express");
const { body } = require("express-validator");
const userController = require("../../controllers/admin/UserController");
const validateRequest = require("../../middleware/validateRequest");
const adminAuthMiddleware = require("../../middleware/adminAuthMiddleware");

const router = express.Router();

/**
 * @route GET /api/admin/stats
 * @desc Get dashboard statistics (Protected)
 */
router.get("/users/list", adminAuthMiddleware, userController.userList);

module.exports = router;
