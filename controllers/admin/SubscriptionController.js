const SubscriptionPlan = require("../../models/SubscriptionPlan");
const UserSubscription = require("../../models/UserSubscription");
const { response } = require("../../utils/response");
const mongoose = require("mongoose");
const slugify = require("slugify"); // ✅ npm i slugify
// Helper: simple price formatting for INR display
const formatPrice = (amount) => {
  if (amount == null) return "";
  // Assuming price stored as integer rupees; adapt if storing paise/other unit
  return `₹${amount.toLocaleString("en-IN")}`;
};

// -------------------- Helper: generate unique slug --------------------
const generateUniqueSlug = async (title, model) => {
  let baseSlug = slugify(title, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;

  while (await model.findOne({ slug })) {
    slug = `${baseSlug}-${counter++}`;
  }
  return slug;
};

exports.getPublicPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ createdAt: 1 });

    const data = plans.map((p) => {
      const percentSaved = calculateSavePercent(p.priceMonthly, p.priceAnnual);

      return {
        id: p._id,
        title: p.title,
        slug: p.slug,
        shortDescription: p.shortDescription,
        features: p.features,
        priceMonthly: p.priceMonthly,
        priceAnnual: p.priceAnnual,
        priceMonthlyText: formatPrice(p.priceMonthly) + " / month",
        priceAnnualText: formatPrice(p.priceAnnual) + " / year",
        savePercent: percentSaved,
        saveText: percentSaved > 0 ? `Save ${percentSaved}%` : null,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        meta: p.meta || {},
      };
    });

    return response(res, true, "Plans fetched", data);
  } catch (err) {
    return response(res, false, err.message);
  }
};

// -------------------- USER: subscribe --------------------
exports.subscribe = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId, planType, paymentReference, metadata = {} } = req.body;

    if (!planId || !mongoose.isValidObjectId(planId)) {
      return response(res, false, "Valid planId is required");
    }
    if (!["monthly", "annual"].includes(planType)) {
      return response(res, false, "planType must be either 'monthly' or 'annual'");
    }

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return response(res, false, "Plan not found or not active");
    }

    const price = planType === "monthly" ? plan.priceMonthly : plan.priceAnnual;

    const startDate = new Date();
    const endDate = new Date(startDate);
    if (planType === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Optionally you could integrate a payment gateway here. For now we save subscription record.
    // Deactivate any previous active subscription (optional: keep history)
    await UserSubscription.updateMany(
      { userId: userId, status: "active" },
      { $set: { status: "expired", endDate: startDate } }
    );

    const sub = await UserSubscription.create({
      userId,
      planId,
      planType,
      price,
      paymentReference: paymentReference || null,
      startDate,
      endDate,
      status: "active",
      metadata,
    });

    return response(res, true, "Subscription activated", sub);
  } catch (err) {
    return response(res, false, err.message);
  }
};

// -------------------- USER: cancel subscription --------------------
exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;

    const activeSub = await UserSubscription.findOne({ userId, status: "active" }).sort({ createdAt: -1 });

    if (!activeSub) {
      return response(res, false, "No active subscription found");
    }

    activeSub.status = "cancelled";
    activeSub.endDate = new Date();
    await activeSub.save();

    return response(res, true, "Subscription cancelled", activeSub);
  } catch (err) {
    return response(res, false, err.message);
  }
};

// -------------------- USER: get my subscription --------------------
exports.getMySubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const sub = await UserSubscription.findOne({ userId }).sort({ createdAt: -1 }).populate("planId");
    if (!sub) {
      return response(res, true, "No subscription found", null);
    }

    const data = {
      id: sub._id,
      plan: sub.planId ? {
        id: sub.planId._id,
        title: sub.planId.title,
        slug: sub.planId.slug,
        features: sub.planId.features,
      } : null,
      planType: sub.planType,
      price: sub.price,
      paymentReference: sub.paymentReference,
      startDate: sub.startDate,
      endDate: sub.endDate,
      status: sub.status,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    };

    return response(res, true, "Subscription fetched", data);
  } catch (err) {
    return response(res, false, err.message);
  }
};

// -------------------- ADMIN: list plans --------------------
exports.adminListPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({}).sort({ createdAt: 1 });
    return response(res, true, "All plans", plans);
  } catch (err) {
    return response(res, false, err.message);
  }
};

// -------------------- ADMIN: create plan --------------------
exports.adminCreatePlan = async (req, res) => {
  try {
    const { title, shortDescription, features = [], priceMonthly = 0, priceAnnual = 0, isActive = true, meta = {} } = req.body;
    const slug = await generateUniqueSlug(title, SubscriptionPlan);

    if (!title) {
      return response(res, false, "title is required");
    }

    const existing = await SubscriptionPlan.findOne({ slug });
    if (existing) {
      return response(res, false, "A plan with this slug already exists");
    }

    const plan = await SubscriptionPlan.create({
      title,
      slug,
      shortDescription,
      features,
      priceMonthly,
      priceAnnual,
      isActive,
      meta,
    });

    return response(res, true, "Plan created", plan);
  } catch (err) {
    return response(res, false, err.message);
  }
};

// -------------------- ADMIN: update plan --------------------
exports.adminUpdatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return response(res, false, "Valid plan id required");
    }
    const payload = req.body;
    // ✅ Auto-generate or validate slug if title changes or slug missing
    if (payload.title && (!payload.slug || payload.slug.trim() === "")) {
      payload.slug = await generateUniqueSlug(payload.title, SubscriptionPlan);
    } else if (payload.slug) {
      const existing = await SubscriptionPlan.findOne({
        slug: payload.slug,
        _id: { $ne: id },
      });
      if (existing) {
        return response(res, false, "A plan with this slug already exists");
      }
    }
    const updated = await SubscriptionPlan.findByIdAndUpdate(id, payload, { new: true });
    return response(res, true, "Plan updated", updated);
  } catch (err) {
    return response(res, false, err.message);
  }
};

// -------------------- ADMIN: delete plan --------------------
exports.adminDeletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return response(res, false, "Valid plan id required");
    }
    await SubscriptionPlan.findByIdAndDelete(id);
    return response(res, true, "Plan deleted");
  } catch (err) {
    return response(res, false, err.message);
  }
};

const calculateSavePercent = (monthlyPrice, annualPrice) => {
  const yearlyIfMonthly = monthlyPrice * 12;
  const saved = yearlyIfMonthly - annualPrice;
  const percent = (saved / yearlyIfMonthly) * 100;
  return Math.round(percent); // rounded to nearest whole %
};