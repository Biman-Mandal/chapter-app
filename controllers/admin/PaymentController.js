const Payment = require("../../models/PaymentSchema");
const { response } = require("../../utils/response");

/**
 * Format a payment document for API responses
 */
const formatPayment = (p = {}) => ({
  id: p._id?.toString() || "",
  userId: p.userId?.toString ? p.userId.toString() : p.userId || "",
  planId: p.planId?.toString ? p.planId.toString() : p.planId || "",
  amount: typeof p.amount !== "undefined" ? Number(p.amount) : 0,
  currency: p.currency || "INR",
  billing_period: p.billing_period || "month",
  payment_method: p.payment_method || "",
  provider: p.provider || "",
  status: p.status || "pending",
  transaction_id: p.transaction_id || "",
  receipt_url: p.receipt_url || null,
  metadata: p.metadata || {},
  refund_info: p.refund_info || null,
  createdAt: p.createdAt || "",
  updatedAt: p.updatedAt || "",
});

// -------------------- LIST PAYMENTS (with filters) --------------------
exports.paymentList = async (req, res) => {
  try {
    const {
      page = 1,
      perPage = 20,
      search,
      status,
      provider,
      planId,
      userId,
      from,
      to,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    if (search) {
      // search transaction_id or metadata.name or userId text
      const re = new RegExp(search, "i");
      query.$or = [
        { transaction_id: re },
        { "metadata.email": re },
        { "metadata.name": re },
      ];
    }

    if (status) query.status = status;
    if (provider) query.provider = provider;
    if (planId) query.planId = planId;
    if (userId) query.userId = userId;

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        // include the day end if date-only passed
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limit = Math.min(parseInt(perPage, 10) || 20, 200);
    const skip = (pageNum - 1) * limit;

    const sortDir = sortOrder === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortDir };

    const [total, docs] = await Promise.all([
      Payment.countDocuments(query),
      Payment.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const formatted = docs.map((d) => formatPayment(d));
    return response(res, true, "Payment list fetched successfully", {
      items: formatted,
      total,
      page: pageNum,
      perPage: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- GET PAYMENT BY ID --------------------
exports.getPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id).lean();
    if (!payment) return response(res, false, "Payment not found");
    return response(res, true, "Payment fetched", formatPayment(payment));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- CREATE PAYMENT (admin) --------------------
exports.createPayment = async (req, res) => {
  try {
    const {
      userId,
      planId,
      amount,
      currency,
      billing_period,
      payment_method,
      provider,
      status,
      transaction_id,
      receipt_url,
      metadata,
    } = req.body;

    if (!userId) return response(res, false, "userId is required");
    if (typeof amount === "undefined") return response(res, false, "amount is required");

    const p = await Payment.create({
      userId,
      planId: planId || null,
      amount: Number(amount || 0),
      currency: currency || "INR",
      billing_period: billing_period || "month",
      payment_method: payment_method || "card",
      provider: provider || "stripe",
      status: status || "pending",
      transaction_id: transaction_id || null,
      receipt_url: receipt_url || null,
      metadata: metadata || {},
    });

    return response(res, true, "Payment created", formatPayment(p));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- UPDATE PAYMENT STATUS / REFUND --------------------
exports.updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      refund_info, // optional object: { refund_txn_id, refunded_at, refund_amount, reason }
      transaction_id,
      receipt_url,
      metadata,
    } = req.body;

    const payment = await Payment.findById(id);
    if (!payment) return response(res, false, "Payment not found");

    if (typeof status !== "undefined") payment.status = status;
    if (typeof transaction_id !== "undefined") payment.transaction_id = transaction_id;
    if (typeof receipt_url !== "undefined") payment.receipt_url = receipt_url;
    if (typeof metadata !== "undefined") payment.metadata = metadata;

    // If refund info provided and status set to refunded -> store refund_info subdoc
    if (refund_info) {
      payment.refund_info = {
        refunded_at: refund_info.refunded_at ? new Date(refund_info.refunded_at) : new Date(),
        refund_txn_id: refund_info.refund_txn_id || refund_info.refund_txn || null,
        refund_amount: typeof refund_info.refund_amount !== "undefined" ? Number(refund_info.refund_amount) : null,
        reason: refund_info.reason || null,
      };
    }

    await payment.save();
    return response(res, true, "Payment updated", formatPayment(payment));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- DELETE PAYMENT --------------------
exports.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);
    if (!payment) return response(res, false, "Payment not found");

    await payment.deleteOne();
    return response(res, true, "Payment deleted");
  } catch (error) {
    return response(res, false, error.message);
  }
};