const PlanSubscription = require("../../models/PlanSubscriptionSchema");
const { response } = require("../../utils/response");

/**
 * Helper to format plan for API response (consistent with existing controllers)
 */
const formatPlan = (p = {}) => ({
  id: p._id?.toString() || "",
  name: p.name || "",
  type: p.type || "",
  monthly_price: p.monthly_price != null ? Number(p.monthly_price) : 0,
  annual_price: p.annual_price != null ? Number(p.annual_price) : 0,
  description: p.description || "",
  is_active: p.is_active ? 1 : 0,
  features: Array.isArray(p.features) ? p.features : p.features ? [p.features] : [],
  additionalinfo: Array.isArray(p.additionalinfo) ? p.additionalinfo : p.additionalinfo ? [p.additionalinfo] : [],
  billing_period: p.billing_period || "month",
  popular: !!p.popular,
  createdAt: p.createdAt || "",
  updatedAt: p.updatedAt || "",
});

// -------------------- PLANS LIST --------------------
exports.planList = async (req, res) => {
  try {
    const { search, status } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
        { features: { $regex: search, $options: "i" } },
        { additionalinfo: { $regex: search, $options: "i" } },
      ];
    }
    if (typeof status !== "undefined") {
      const st = String(status) === "1" || String(status).toLowerCase() === "true";
      query.is_active = st;
    }

    const plans = await PlanSubscription.find(query).sort({ createdAt: -1 });
    const formatted = plans.map((p) => formatPlan(p));

    return response(res, true, "Plan list fetched successfully", formatted);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- CREATE PLAN --------------------
exports.createPlan = async (req, res) => {
  try {
    const {
      name,
      type,
      monthly_price,
      annual_price,
      description,
      is_active,
      features,
      additionalinfo,
      billing_period,
      popular,
    } = req.body;

    if (!name || !String(name).trim()) {
      return response(res, false, "Plan name is required");
    }

    const existing = await PlanSubscription.findOne({ name: name.trim() });
    if (existing) return response(res, false, "Plan name already exists");

    // Ensure features is an array
    const normalizedFeatures = Array.isArray(features)
      ? features.map((f) => (typeof f === "string" ? f.trim() : f)).filter(Boolean)
      : [];

    // Ensure additionalinfo is an array
    const normalizedAdditional = Array.isArray(additionalinfo)
      ? additionalinfo
      : additionalinfo
      ? [additionalinfo]
      : [];

    // Basic monthly/annual logic: if annual_price is missing and monthly_price provided, set annual_price = monthly_price * 12
    let mPrice = Number(monthly_price || 0);
    let aPrice = Number(annual_price || 0);
    if ((!aPrice || aPrice <= 0) && mPrice > 0) {
      aPrice = parseFloat((mPrice * 12).toFixed(2));
    }

    const plan = await PlanSubscription.create({
      name: name.trim(),
      type: type || "",
      monthly_price: mPrice,
      annual_price: aPrice,
      description: description || "",
      is_active: typeof is_active === "undefined" ? true : !!is_active,
      features: normalizedFeatures,
      additionalinfo: normalizedAdditional,
      billing_period: billing_period || "month",
      popular: !!popular,
    });

    return response(res, true, "Plan created successfully", formatPlan(plan));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- UPDATE PLAN --------------------
exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      monthly_price,
      annual_price,
      description,
      is_active,
      features,
      additionalinfo,
      billing_period,
      popular,
    } = req.body;

    const plan = await PlanSubscription.findById(id);
    if (!plan) return response(res, false, "Plan not found");

    // If name changed, ensure uniqueness
    if (name && name.trim() && name.trim() !== plan.name) {
      const existing = await PlanSubscription.findOne({ name: name.trim(), _id: { $ne: id } });
      if (existing) return response(res, false, "Plan name already exists");
      plan.name = name.trim();
    }

    plan.type = typeof type !== "undefined" ? type : plan.type;

    const mPrice = typeof monthly_price !== "undefined" ? Number(monthly_price) : plan.monthly_price;
    let aPrice = typeof annual_price !== "undefined" ? Number(annual_price) : plan.annual_price;

    // If user provided monthly and annual is not provided/zero -> compute annual = monthly * 12
    if ((typeof annual_price === "undefined" || !aPrice || aPrice <= 0) && mPrice > 0) {
      aPrice = parseFloat((mPrice * 12).toFixed(2));
    }

    plan.monthly_price = mPrice;
    plan.annual_price = aPrice;

    plan.description = typeof description !== "undefined" ? description : plan.description;
    if (typeof is_active !== "undefined") plan.is_active = !!is_active;

    if (typeof features !== "undefined") {
      plan.features = Array.isArray(features)
        ? features.map((f) => (typeof f === "string" ? f.trim() : f)).filter(Boolean)
        : [];
    }

    if (typeof additionalinfo !== "undefined") {
      plan.additionalinfo = Array.isArray(additionalinfo) ? additionalinfo : [additionalinfo];
    }

    plan.billing_period = billing_period || plan.billing_period;
    if (typeof popular !== "undefined") plan.popular = !!popular;

    await plan.save();

    return response(res, true, "Plan updated successfully", formatPlan(plan));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- DELETE PLAN --------------------
exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await PlanSubscription.findById(id);
    if (!plan) return response(res, false, "Plan not found");

    await plan.deleteOne();

    return response(res, true, "Plan deleted successfully");
  } catch (error) {
    return response(res, false, error.message);
  }
};