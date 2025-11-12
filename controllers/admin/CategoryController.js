const Category = require("../../models/CategorySchema");
const { response } = require("../../utils/response");

const formatCategory = (cat = {}) => ({
  id: cat._id?.toString() || "",
  name: cat.name || "",
  slug: cat.slug || "",
  // parentId removed
  description: cat.description || "",
  image: cat.image || "",
  status: cat.status ? 1 : 0,
  createdAt: cat.createdAt || "",
  updatedAt: cat.updatedAt || "",
});

// -------------------- CATEGORY LIST --------------------
exports.categoryList = async (req, res) => {
  try {
    const { search, status } = req.query;

    const query = {};
    if (search) query.name = { $regex: search, $options: "i" };
    if (typeof status !== "undefined") query.status = status;

    const categories = await Category.find(query).sort({ createdAt: -1 });
    const formatted = categories.map((c) => formatCategory(c));

    return response(res, true, "Category list fetched successfully", formatted);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- CREATE CATEGORY --------------------
exports.createCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;

    const existing = await Category.findOne({ name: name.trim() });
    if (existing) return response(res, false, "Category name already exists");

    const category = await Category.create({
      name,
      description,
      image,
    });

    return response(res, true, "Category created successfully", formatCategory(category));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- UPDATE CATEGORY --------------------
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, status } = req.body;

    const category = await Category.findById(id);
    if (!category) return response(res, false, "Category not found");

    category.name = name || category.name;
    category.description = description || category.description;
    category.image = image || category.image;
    if (typeof status !== "undefined") category.status = status;

    await category.save();

    return response(res, true, "Category updated successfully", formatCategory(category));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- DELETE CATEGORY --------------------
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) return response(res, false, "Category not found");

    await category.deleteOne();

    return response(res, true, "Category deleted successfully");
  } catch (error) {
    return response(res, false, error.message);
  }
};
