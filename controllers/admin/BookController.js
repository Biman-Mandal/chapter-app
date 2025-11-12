const Book = require("../../models/BookSchema");
const Chapter = require("../../models/ChapterSchema");
const { response } = require("../../utils/response");
const path = require("path");

// helper to map uploaded files from req.files (fields)
const mapFiles = (bookPayload = {}, files = {}) => {
  const result = { ...bookPayload };
  if (files.coverImage && files.coverImage[0]) {
    result.coverImage = `/uploads/${files.coverImage[0].filename}`;
  }
  if (files.backgroundImage && files.backgroundImage[0]) {
    result.backgroundImage = `/uploads/${files.backgroundImage[0].filename}`;
  }
  return result;
};

// -------------------- LIST BOOKS --------------------
exports.bookList = async (req, res) => {
  try {
    const { search, author, active } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortDesc: { $regex: search, $options: "i" } },
        { longDesc: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
      ];
    }
    if (author) query.author = author;
    if (typeof active !== "undefined") query.active = active === "true";

    // return all matching books sorted by createdAt desc
    const books = await Book.find(query).sort({ createdAt: -1 });

    // fetch chapter counts for each book in parallel
    const counts = await Promise.all(books.map((b) => Chapter.countDocuments({ bookId: b._id })));

    const result = books.map((b, idx) => {
      const obj = b.toObject();
      obj.chapterCount = counts[idx] || 0;
      return obj;
    });

    return response(res, true, "Book list fetched successfully", result);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- DISTINCT AUTHORS --------------------
exports.listAuthors = async (req, res) => {
  try {
    const authors = await Book.distinct("author");
    return response(res, true, "Authors fetched", authors);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- GET SINGLE BOOK --------------------
exports.getBook = async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id).populate("categories");
    if (!book) return response(res, false, "Book not found");

    // include chapters list for details
    const chapters = await Chapter.find({ bookId: book._id }).sort({ createdAt: -1 });
    const obj = book.toObject();
    obj.chapters = chapters;
    obj.chapterCount = chapters.length;

    return response(res, true, "Book fetched", obj);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- CREATE BOOK --------------------
exports.createBook = async (req, res) => {
  try {
    const payload = req.body || {};

    // parse categories (expect array of ids)
    let categories = [];
    if (payload.categories) {
      try {
        categories = typeof payload.categories === "string" ? JSON.parse(payload.categories) : payload.categories;
      } catch (e) {
        categories = payload.categories || [];
      }
    }

    // parse tags if present
    let tags = [];
    if (payload.tags) {
      try {
        tags = typeof payload.tags === "string" ? JSON.parse(payload.tags) : payload.tags;
      } catch (e) {
        tags = payload.tags || [];
      }
    }

    const files = req.files || {};
    const mapped = mapFiles({}, files);

    const book = await Book.create({
      title: payload.title,
      author: payload.author,
      quote: payload.quote || "",
      shortDesc: payload.shortDesc || "",
      longDesc: payload.longDesc || "",
      coverImage: mapped.coverImage || payload.coverImage || "",
      backgroundImage: mapped.backgroundImage || payload.backgroundImage || "",
      tags,
      categories,
      meta: payload.meta ? (typeof payload.meta === "string" ? JSON.parse(payload.meta) : payload.meta) : {},
      createdBy: req.user ? req.user._id : undefined,
    });

    return response(res, true, "Book created successfully", book);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- UPDATE BOOK --------------------
exports.updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    const book = await Book.findById(id);
    if (!book) return response(res, false, "Book not found");

    // parse categories (if provided)
    let categories = book.categories || [];
    if (typeof payload.categories !== "undefined") {
      try {
        categories = typeof payload.categories === "string" ? JSON.parse(payload.categories) : payload.categories;
      } catch (e) {
        categories = payload.categories || [];
      }
    }

    // parse tags if present
    let tags = book.tags || [];
    if (typeof payload.tags !== "undefined") {
      try {
        tags = typeof payload.tags === "string" ? JSON.parse(payload.tags) : payload.tags;
      } catch (e) {
        tags = payload.tags || [];
      }
    }

    const files = req.files || {};
    const mapped = mapFiles({}, files);

    book.title = payload.title || book.title;
    book.author = payload.author || book.author;
    book.quote = typeof payload.quote !== "undefined" ? payload.quote : book.quote;
    book.shortDesc = typeof payload.shortDesc !== "undefined" ? payload.shortDesc : book.shortDesc;
    book.longDesc = typeof payload.longDesc !== "undefined" ? payload.longDesc : book.longDesc;
    book.coverImage = mapped.coverImage || (typeof payload.coverImage !== "undefined" ? payload.coverImage : book.coverImage);
    book.backgroundImage = mapped.backgroundImage || (typeof payload.backgroundImage !== "undefined" ? payload.backgroundImage : book.backgroundImage);
    book.tags = tags;
    book.categories = categories;
    book.meta = payload.meta ? (typeof payload.meta === "string" ? JSON.parse(payload.meta) : payload.meta) : book.meta;
    book.active = typeof payload.active !== "undefined" ? (payload.active === "true" || payload.active === true) : book.active;

    await book.save();
    return response(res, true, "Book updated successfully", book);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- DELETE BOOK --------------------
exports.deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);
    if (!book) return response(res, false, "Book not found");

    await book.deleteOne();
    return response(res, true, "Book deleted successfully");
  } catch (error) {
    return response(res, false, error.message);
  }
};