const express = require("express");
const router = express.Router();
const subscriptionController = require("../../controllers/admin/SubscriptionController");
const authMiddleware = require("../../middleware/authMiddleware");
const adminMiddleware = require("../../middleware/adminAuthMiddleware");
const { body } = require("express-validator");
const validateRequest = require("../../middleware/validateRequest");

// GET /api/admin/subscriptions/list
router.get("/list", authMiddleware, adminMiddleware, subscriptionController.adminListPlans);

// POST /api/admin/subscriptions/create
router.post(
  "/create",
  authMiddleware,
  adminMiddleware,
  [
    body("title").notEmpty().withMessage("title is required"),
    validateRequest,
  ],
  subscriptionController.adminCreatePlan
);

// PUT /api/admin/subscriptions/update/:id
router.put(
  "/update/:id",
  authMiddleware,
  adminMiddleware,
  subscriptionController.adminUpdatePlan
);

// DELETE /api/admin/subscriptions/delete/:id
router.delete("/delete/:id", authMiddleware, adminMiddleware, subscriptionController.adminDeletePlan);

module.exports = router;