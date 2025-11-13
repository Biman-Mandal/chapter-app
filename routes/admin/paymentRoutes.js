const express = require("express");
const router = express.Router();
const paymentController = require("../../controllers/admin/PaymentController");
const adminAuthMiddleware = require("../../middleware/adminAuthMiddleware");

router.get("/list", adminAuthMiddleware, paymentController.paymentList);
router.get("/get/:id", adminAuthMiddleware, paymentController.getPayment);
router.post("/create", adminAuthMiddleware, paymentController.createPayment);
router.put("/update/:id", adminAuthMiddleware, paymentController.updatePayment);
router.delete("/delete/:id", adminAuthMiddleware, paymentController.deletePayment);

module.exports = router;