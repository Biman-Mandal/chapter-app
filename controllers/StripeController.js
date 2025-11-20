const Stripe = require("stripe");
const PlanSubscription = require("../models/PlanSubscriptionSchema");
const UserSubscription = require("../models/UserSubscription");
const User = require("../models/UserSchema");
const { response } = require("../utils/response");
const mongoose = require("mongoose");

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || "2022-11-15";
const stripe = Stripe(STRIPE_SECRET, { apiVersion: STRIPE_API_VERSION });

/**
 * Helper: compute approximate end date based on billing_period
 */
function computeEndDate(startDate, billing_period) {
  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date(start);
  if (!billing_period || billing_period === "month") {
    end.setMonth(end.getMonth() + 1);
  } else if (billing_period === "annual" || billing_period === "year") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    // fallback to 1 month
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

/**
 * GET /api/front/plans
 * Public endpoint: returns plans with is_subscribe flag for authenticated users.
 */
exports.listPlans = async (req, res) => {
  try {
    // fetch plans (active by default)
    const plans = await PlanSubscription.find({ is_active: true }).lean();

    // default: no subscription
    let activeSub = null;
    if (req.user && req.user.userId) {
      activeSub = await UserSubscription.findOne({
        userId: req.user.userId,
        status: "active",
      }).lean();
    }

    const items = plans.map((p) => {
      const isSub = activeSub && String(activeSub.planId) === String(p._id) ? 1 : 0;
      return {
        id: p._id,
        name: p.name,
        type: p.type,
        description: p.description,
        features: p.features || [],
        additionalinfo: p.additionalinfo || [],
        billing_period: p.billing_period || "month",
        monthly_price: p.monthly_price || 0,
        annual_price: p.annual_price || 0,
        price: p.apiPrice ? p.apiPrice() : p.apiPrice, // older installations
        stripePriceId: p.stripePriceId || null,
        is_subscribe: isSub,
        createdAt: p.createdAt || null,
        updatedAt: p.updatedAt || null,
      };
    });

    return response(res, true, "Plans fetched", { items, total: items.length });
  } catch (err) {
    console.error("listPlans error:", err);
    return response(res, false, err.message || "Failed to fetch plans");
  }
};

/**
 * GET /api/front/plans/current
 * Auth required.
 * Returns user's current active subscription if any.
 */
exports.currentPlan = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) return response(res, false, "Authentication required");

    const sub = await UserSubscription.findOne({
      userId: req.user.userId,
      status: "active",
    })
      .populate("planId")
      .lean();

    if (!sub) return response(res, true, "No active subscription", { subscription: null });

    const plan = sub.planId || null;

    const out = {
      id: sub._id,
      plan: plan
        ? {
            id: plan._id,
            name: plan.name,
            stripePriceId: plan.stripePriceId || null,
            billing_period: plan.billing_period || "month",
          }
        : null,
      price: sub.price,
      planType: sub.planType,
      stripeSubscriptionId: sub.stripeSubscriptionId || null,
      stripeCustomerId: sub.stripeCustomerId || null,
      startDate: sub.startDate,
      endDate: sub.endDate,
      status: sub.status,
      createdAt: sub.createdAt,
    };

    return response(res, true, "Current subscription fetched", { subscription: out });
  } catch (err) {
    console.error("currentPlan error:", err);
    return response(res, false, err.message || "Failed to fetch current plan");
  }
};

/**
 * POST /api/front/plans/subscribe
 * Body: { planId, paymentMethodId (optional) }
 * Auth required.
 *
 * Behavior:
 *  - If user already has active subscription, cancel it (both Stripe & DB) before creating a new one.
 *  - Create (or reuse) Stripe Customer, attach payment method (if provided), create Stripe subscription for the plan's stripePriceId.
 *  - Save UserSubscription record with stripe ids.
 *  - Return subscription info and, if payment required, client_secret for PaymentIntent so frontend can confirm.
 */
exports.subscribe = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) return response(res, false, "Authentication required");

    const { planId, paymentMethodId } = req.body;
    if (!planId) return response(res, false, "planId is required");

    const plan = await PlanSubscription.findById(planId).lean();
    if (!plan) return response(res, false, "Plan not found");

    if (!plan.stripePriceId) {
      return response(res, false, "Plan is not configured with a Stripe price id");
    }

    const user = await User.findById(req.user.userId);
    if (!user) return response(res, false, "User not found");

    // Step 1: Cancel existing active subscription (if any)
    const existing = await UserSubscription.findOne({
      userId: req.user.userId,
      status: "active",
    });

    if (existing) {
      // Cancel on Stripe if we have stripeSubscriptionId
      try {
        if (existing.stripeSubscriptionId) {
          await stripe.subscriptions.del(existing.stripeSubscriptionId);
        }
      } catch (err) {
        // Log and continue to update DB record to cancelled
        console.warn("Failed to cancel previous stripe subscription:", err && err.message);
      }

      existing.status = "cancelled";
      existing.endDate = new Date();
      await existing.save();
    }

    // Step 2: create Stripe customer
    // If you store stripeCustomerId somewhere on User or previous subscription metadata, you can reuse it.
    let stripeCustomerId = null;

    // Try to pick from previous subscriptions if any
    const lastSubWithCustomer = await UserSubscription.findOne({
      userId: req.user.userId,
      stripeCustomerId: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 }).lean();

    if (lastSubWithCustomer && lastSubWithCustomer.stripeCustomerId) {
      stripeCustomerId = lastSubWithCustomer.stripeCustomerId;
    } else {
      // create a new customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName || undefined,
        metadata: { userId: String(user._id) },
      });
      stripeCustomerId = customer.id;
    }

    // Step 3: attach payment method if provided and set as default for invoices
    if (paymentMethodId) {
      try {
        // attach payment method to customer
        await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
        // set default payment method for invoices
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
      } catch (err) {
        console.error("attach payment method failed:", err);
        return response(res, false, "Failed to attach payment method: " + (err.message || ""));
      }
    }

    // Step 4: create subscription
    const subCreateParams = {
      customer: stripeCustomerId,
      items: [{ price: String(plan.stripePriceId) }],
      expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
      // default behavior: let Stripe handle invoicing; use default payment method set on customer
      payment_behavior: "default_incomplete",
      metadata: {
        appUserId: String(user._id),
        planId: String(plan._id),
      },
    };

    const stripeSub = await stripe.subscriptions.create(subCreateParams);

    // Determine payment intent client secret if needed
    let clientSecret = null;
    if (stripeSub.latest_invoice && stripeSub.latest_invoice.payment_intent) {
      clientSecret = stripeSub.latest_invoice.payment_intent.client_secret || null;
    }

    // Step 5: Create subscription record in DB
    const startDate = new Date();
    const endDate = computeEndDate(startDate, plan.billing_period || plan.billing_period);

    const newSub = await UserSubscription.create({
      userId: req.user.userId,
      planId: plan._id,
      planType: plan.billing_period || "monthly",
      price: (plan.billing_period === "year" || plan.billing_period === "annual") ? plan.annual_price : plan.monthly_price,
      paymentReference: stripeSub.latest_invoice ? stripeSub.latest_invoice.id : null,
      paymentReferenceStatus: stripeSub.status || null,
      startDate,
      endDate,
      status: "active",
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId: stripeCustomerId,
      metadata: { stripeRaw: stripeSub },
    });

    return res.status(200).json({
      status: true,
      message: "Subscription created",
      data: {
        subscriptionId: newSub._id,
        stripeSubscriptionId: stripeSub.id,
        clientSecret,
        requiresAction: !!clientSecret,
      },
    });
  } catch (err) {
    console.error("subscribe error:", err);
    return response(res, false, err.message || "Failed to create subscription");
  }
};

/**
 * POST /api/front/plans/pause
 * Body: { subscriptionId } OR pauses current active subscription
 * Auth required.
 *
 * Uses Stripe pause_collection to pause future invoices.
 */
exports.pauseSubscription = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) return response(res, false, "Authentication required");

    const { subscriptionId } = req.body;

    let sub = null;
    if (subscriptionId) {
      sub = await UserSubscription.findOne({ _id: subscriptionId, userId: req.user.userId });
    } else {
      sub = await UserSubscription.findOne({ userId: req.user.userId, status: "active" }).sort({ createdAt: -1 });
    }

    if (!sub) return response(res, false, "Active subscription not found");

    if (!sub.stripeSubscriptionId) {
      sub.status = "paused";
      await sub.save();
      return response(res, true, "Subscription paused (local)", { subscription: sub });
    }

    // Call Stripe to pause collection
    try {
      const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        pause_collection: { behavior: "keep_as_draft" }, // keep invoices as draft while paused
      });

      sub.status = "paused";
      sub.metadata = sub.metadata || {};
      sub.metadata.stripeRaw = updated;
      await sub.save();

      return response(res, true, "Subscription paused", { subscription: sub });
    } catch (err) {
      console.error("pause subscription stripe error:", err);
      return response(res, false, "Failed to pause subscription: " + (err.message || ""));
    }
  } catch (err) {
    console.error("pauseSubscription error:", err);
    return response(res, false, err.message || "Failed to pause subscription");
  }
};