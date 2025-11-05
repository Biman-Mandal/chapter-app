const mongoose = require("mongoose");

const subscriptionPlanSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true }, // e.g. monthly, annual
    shortDescription: { type: String, default: "" },
    features: { type: [String], default: [] },
    priceMonthly: { type: Number, default: 0 }, // amount in smallest currency unit or INRs
    priceAnnual: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

const SubscriptionPlan = mongoose.model("subscription_plans", subscriptionPlanSchema);

module.exports = SubscriptionPlan;