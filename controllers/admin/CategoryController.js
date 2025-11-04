const Category = require("../../models/CategorySchema");
const { response } = require("../../utils/response");

const formatCategory = (cat = {}) => ({
  id: cat._id?.toString() || "",
  name: cat.name || "",
  slug: cat.slug || "",
  parentId: cat.parentId || null,
  description: cat.description || "",
  image: cat.image || "",
  status: cat.status ? 1 : 0,
  createdAt: cat.createdAt || "",
  updatedAt: cat.updatedAt || "",
});

// -------------------- CATEGORY LIST --------------------
exports.categoryList = async (req, res) => {
  try {
    const { search, status, parentId } = req.query;

    const query = {};
    if (search) query.name = { $regex: search, $options: "i" };
    if (typeof status !== "undefined") query.status = status;
    // query.parentId = parentId || null;

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
    const { name, description, parentId, image } = req.body;

    const existing = await Category.findOne({ name: name.trim() });
    if (existing) return response(res, false, "Category name already exists");

    const category = await Category.create({
      name,
      description,
      parentId: parentId || null,
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
    const { name, description, parentId, image, status } = req.body;

    const category = await Category.findById(id);
    if (!category) return response(res, false, "Category not found");

    category.name = name || category.name;
    category.description = description || category.description;
    category.parentId = parentId || null;
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

// -------------------- SUBCATEGORY LIST --------------------
exports.subCategoryList = async (req, res) => {
  try {
    const { parentId } = req.params;
    if (!parentId) return response(res, false, "Parent category ID required");

    const subcategories = await Category.find({ parentId }).sort({ createdAt: -1 });
    const formatted = subcategories.map((c) => formatCategory(c));

    return response(res, true, "Subcategories fetched successfully", formatted);
  } catch (error) {
    return response(res, false, error.message);
  }
};
