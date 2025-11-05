const mongoose = require("mongoose");

const userSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "subscription_plans", required: true },
    planType: { type: String, enum: ["monthly", "annual"], required: true },
    price: { type: Number, required: true },
    paymentReference: { type: String, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ["active", "cancelled", "expired"], default: "active" },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

const UserSubscription = mongoose.model("user_subscriptions", userSubscriptionSchema);

module.exports = UserSubscription;