// Public-facing category controller for frontend (no auth required)
const Category = require("../models/CategorySchema");
const { response } = require("../utils/response");

/**
 * GET /api/categories/list
 * Public endpoint: returns active categories (or filtered by query)
 * Query:
 *   - search: text to search category name
 *   - status: optional (1/0 or true/false) to include active/inactive explicitly
 */
exports.list = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (search) {
      query.name = { $regex: String(search), $options: "i" };
    }

    // By default return only active categories. If caller provides status, use it.
    if (typeof status !== "undefined" && status !== null && String(status).length > 0) {
      const st = String(status) === "1" || String(status).toLowerCase() === "true";
      query.status = st;
    } else {
      query.status = true;
    }

    const categories = await Category.find(query).sort({ createdAt: -1 }).lean();

    const formatted = categories.map((c) => ({
      id: c._id?.toString() || "",
      name: c.name || "",
      slug: c.slug || "",
      description: c.description || "",
      image: c.image || "",
      status: c.status ? 1 : 0,
      createdAt: c.createdAt || "",
      updatedAt: c.updatedAt || "",
    }));

    return response(res, true, "Categories fetched successfully", formatted);
  } catch (error) {
    return response(res, false, error.message || "Failed to fetch categories");
  }
};