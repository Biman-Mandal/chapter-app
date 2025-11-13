const express = require("express");
const router = express.Router();
const planController = require("../../controllers/admin/PlanController");
const adminAuthMiddleware = require("../../middleware/adminAuthMiddleware");

// All routes protected by admin auth middleware
router.get("/list", adminAuthMiddleware, planController.planList);
router.post("/create", adminAuthMiddleware, planController.createPlan);
router.put("/update/:id", adminAuthMiddleware, planController.updatePlan);
router.delete("/delete/:id", adminAuthMiddleware, planController.deletePlan);

module.exports = router;