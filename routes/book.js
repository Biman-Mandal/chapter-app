const express = require("express");
const router = express.Router();
const BookController = require("../controllers/BookController");
const authMiddleware = require("../middleware/authMiddleware");

// GET /api/books
// Query params support: search, author, category, tag, active, sortBy, sortOrder, page, perPage, type
router.get("/", authMiddleware, BookController.list);

// GET /api/books/:id
// Optional query string or header X-Guest-Identifier to fetch progress for guests
router.get("/:id", authMiddleware, BookController.getDetails);

module.exports = router;