const express = require("express");
const router = express.Router();
const StripeController = require("../controllers/StripeController");
const authMiddleware = require("../middleware/authMiddleware");

// Public: list plans, returns is_subscribe flag if auth provided
router.get("/", authMiddleware, StripeController.listPlans);
// If you want public without auth, change to: router.get("", StripeController.listPlans);

// Auth required: subscribe, current plan, pause
router.post("/subscribe", authMiddleware, StripeController.subscribe);
router.get("/current", authMiddleware, StripeController.currentPlan);
router.post("/pause", authMiddleware, StripeController.pauseSubscription);

module.exports = router;