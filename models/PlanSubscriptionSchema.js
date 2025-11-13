const mongoose = require("mongoose");
const { softDeletePlugin } = require("../middleware/softDelete");

/**
 * Mongoose schema for PlanSubscription.
 * - features: array of feature strings (primary features)
 * - additionalinfo: array of strings (additional features/info)
 *
 * Mirrors the provided Sequelize schema semantics.
 */
const planSubscriptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
    },
    type: {
      type: String,
      trim: true,
      default: "",
    },
    monthly_price: {
      type: Number,
      default: 0,
    },
    annual_price: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    // Primary features list
    features: {
      type: [String],
      default: [],
    },
    // Additional features / additional info as an array of strings or mixed objects
    additionalinfo: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    billing_period: {
      type: String,
      enum: ["month", "year", "annual"],
      default: "month",
    },
    popular: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Soft delete plugin (if you use soft deletes in your project)
if (softDeletePlugin) {
  planSubscriptionSchema.plugin(softDeletePlugin);
}

// Instance helper similar to Sequelize apiPrice method
planSubscriptionSchema.methods.apiPrice = function () {
  const period = this.billing_period || "month";
  if (period === "year" || period === "annual") {
    return { price: parseFloat(this.annual_price || 0), period: "year" };
  }
  return { price: parseFloat(this.monthly_price || 0), period: "month" };
};

const PlanSubscription = mongoose.model("plan_subscriptions", planSubscriptionSchema);
module.exports = PlanSubscription;