const mongoose = require("mongoose");

const userSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "plan_subscriptions", required: true },
    planType: { type: String, enum: ["monthly", "annual"], required: true },
    price: { type: Number, required: true },
    paymentReference: { type: String, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // extended status options to include paused
    status: { type: String, enum: ["active", "cancelled", "expired", "paused"], default: "active" },
    metadata: { type: Object, default: {} },

    // Stripe related fields:
    stripeSubscriptionId: { type: String, default: null },
    stripeCustomerId: { type: String, default: null },
  },
  { timestamps: true }
);

const UserSubscription = mongoose.model("user_subscriptions", userSubscriptionSchema);

module.exports = UserSubscription;