const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "plan_subscriptions",
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    billing_period: {
      type: String,
      enum: ["month", "year", "annual"],
      default: "month",
    },
    payment_method: {
      type: String,
      default: "card", // card, netbanking, upi, wallet, etc
    },
    provider: {
      type: String,
      default: "stripe", // stripe, paypal, razorpay, custom
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded", "cancelled"],
      default: "pending",
    },
    transaction_id: {
      type: String,
      index: true,
      default: null,
    },
    receipt_url: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    refund_info: {
      refunded_at: { type: Date },
      refund_txn_id: { type: String },
      refund_amount: { type: Number },
      reason: { type: String },
    },
  },
  { timestamps: true }
);

const Payment = mongoose.model("payments", paymentSchema);
module.exports = Payment;