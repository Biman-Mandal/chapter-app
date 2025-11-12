const express = require("express");
const router = express.Router();
const bookController = require("../../controllers/admin/BookController");
const adminAuthMiddleware = require("../../middleware/adminAuthMiddleware");
const upload = require("../../middleware/uploadMiddleware");

// protected admin routes
router.get("/list", adminAuthMiddleware, bookController.bookList);
router.get("/authors", adminAuthMiddleware, bookController.listAuthors);
router.get("/:id", adminAuthMiddleware, bookController.getBook);

// use fields for coverImage and backgroundImage
router.post("/create", adminAuthMiddleware, upload.fields([{ name: "coverImage", maxCount: 1 }, { name: "backgroundImage", maxCount: 1 }]), bookController.createBook);
router.put("/update/:id", adminAuthMiddleware, upload.fields([{ name: "coverImage", maxCount: 1 }, { name: "backgroundImage", maxCount: 1 }]), bookController.updateBook);
router.delete("/delete/:id", adminAuthMiddleware, bookController.deleteBook);

module.exports = router;