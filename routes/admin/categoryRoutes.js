const express = require("express");
const router = express.Router();
const categoryController = require("../../controllers/admin/CategoryController");
const adminAuthMiddleware = require("../../middleware/adminAuthMiddleware");

// 🔐 All routes protected
router.get("/list", adminAuthMiddleware, categoryController.categoryList);
router.get("/subcategories/:parentId", adminAuthMiddleware, categoryController.subCategoryList);
router.post("/create", adminAuthMiddleware, categoryController.createCategory);
router.put("/update/:id", adminAuthMiddleware, categoryController.updateCategory);
router.delete("/delete/:id", adminAuthMiddleware, categoryController.deleteCategory);

module.exports = router;
