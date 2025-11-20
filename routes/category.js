const express = require("express");
const router = express.Router();
const categoryPublicController = require("../controllers/CategoryController");

// Public category list used by frontend
// GET /api/categories/list
router.get("/list", categoryPublicController.list);

module.exports = router;