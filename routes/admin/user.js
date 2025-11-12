const express = require("express");
const { body } = require("express-validator");
const userController = require("../../controllers/admin/UserController");
const validateRequest = require("../../middleware/validateRequest");
const adminAuthMiddleware = require("../../middleware/adminAuthMiddleware");

const router = express.Router();

/**
 * @route GET /api/admin/users/list
 * @desc Get registered users list (Protected)
 */
router.get("/users/list", adminAuthMiddleware, userController.userList);

/**
 * @route GET /api/admin/users/:id
 * @desc Get single user details (Protected)
 */
router.get("/users/:id", adminAuthMiddleware, userController.userDetails);

/**
 * @route PATCH /api/admin/users/:id/status
 * @desc Toggle or set user status (Protected)
 *       body: { status?: 0|1 } if omitted it toggles
 */
router.patch("/users/:id/status", adminAuthMiddleware, userController.setUserStatus);

module.exports = router;