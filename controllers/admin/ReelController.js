const Reel = require("../../models/ReelSchema");
const Book = require("../../models/BookSchema");
const Chapter = require("../../models/ChapterSchema");
const Category = require("../../models/CategorySchema");
const { response } = require("../../utils/response");

// helper to map uploaded media file
const mapMediaFile = (file) => {
  if (!file) return {};
  const rel = `/uploads/${file.filename}`;
  const mime = file.mimetype || "";
  let mediaType = "";
  if (mime.startsWith("image/")) mediaType = "image";
  else if (mime.startsWith("video/")) mediaType = "video";
  else if (mime.startsWith("audio/")) mediaType = "audio";
  return { mediaPath: rel, mediaType, mediaOriginalName: file.originalname };
};

// -------------------- LIST REELS --------------------
exports.reelList = async (req, res) => {
  try {
    const { search, bookId, tag, category, active, page = 1, limit = 50 } = req.query;
    const q = {};
    if (search) {
      q.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortDesc: { $regex: search, $options: "i" } },
        { longDesc: { $regex: search, $options: "i" } },
        { creatorText: { $regex: search, $options: "i" } },
      ];
    }
    if (bookId) q.bookId = bookId;
    if (tag) q.tags = tag;
    if (category) q.categories = category;
    if (typeof active !== "undefined") q.active = active === "true";

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    // populate book, chapter and categories so frontend can show names
    const items = await Reel.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("bookId")
      .populate("chapterId")
      .populate("categories");
    const total = await Reel.countDocuments(q);

    return response(res, true, "Reels fetched", { items, total });
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- GET SINGLE REEL --------------------
exports.getReel = async (req, res) => {
  try {
    const { id } = req.params;
    const reel = await Reel.findById(id).populate("bookId").populate("chapterId").populate("categories");
    if (!reel) return response(res, false, "Reel not found");
    return response(res, true, "Reel fetched", reel);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- CREATE REEL --------------------
exports.createReel = async (req, res) => {
  try {
    const payload = req.body || {};

    // parse tags & categories (they may be sent stringified)
    let tags = [];
    if (payload.tags) {
      try {
        tags = typeof payload.tags === "string" ? JSON.parse(payload.tags) : payload.tags;
      } catch (e) {
        tags = payload.tags || [];
      }
    }

    let categories = [];
    if (payload.categories) {
      try {
        categories = typeof payload.categories === "string" ? JSON.parse(payload.categories) : payload.categories;
      } catch (e) {
        categories = payload.categories || [];
      }
    }

    // validate book and chapter if provided
    if (payload.bookId) {
      const bookExists = await Book.findById(payload.bookId);
      if (!bookExists) return response(res, false, "Book not found");
    }
    if (payload.chapterId) {
      const chExists = await Chapter.findById(payload.chapterId);
      if (!chExists) return response(res, false, "Chapter not found");
    }

    // validate category ids (optional: only ensure they exist)
    if (Array.isArray(categories) && categories.length > 0) {
      const validIds = await Category.find({ _id: { $in: categories } }).select("_id").lean();
      const validSet = new Set(validIds.map((c) => c._id.toString()));
      categories = categories.filter((cid) => validSet.has(cid.toString()));
    }

    const file = req.file; // upload.single('media')
    const mapped = mapMediaFile(file);

    const reel = await Reel.create({
      title: payload.title,
      shortDesc: payload.shortDesc || "",
      longDesc: payload.longDesc || "",
      creatorText: payload.creatorText || "",
      bookId: payload.bookId || null,
      bookQuoteText: payload.bookQuoteText || "",
      chapterId: payload.chapterId || null,
      tags,
      categories,
      mediaPath: mapped.mediaPath || payload.mediaPath || "",
      mediaType: mapped.mediaType || "",
      mediaOriginalName: mapped.mediaOriginalName || "",
      meta: payload.meta ? (typeof payload.meta === "string" ? JSON.parse(payload.meta) : payload.meta) : {},
      createdBy: req.user ? req.user._id : undefined,
    });

    const created = await Reel.findById(reel._id).populate("bookId").populate("chapterId").populate("categories");

    return response(res, true, "Reel created successfully", created);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- UPDATE REEL --------------------
exports.updateReel = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const reel = await Reel.findById(id);
    if (!reel) return response(res, false, "Reel not found");

    // parse tags & categories
    let tags = reel.tags || [];
    if (typeof payload.tags !== "undefined") {
      try {
        tags = typeof payload.tags === "string" ? JSON.parse(payload.tags) : payload.tags;
      } catch (e) {
        tags = payload.tags || [];
      }
    }

    let categories = reel.categories || [];
    if (typeof payload.categories !== "undefined") {
      try {
        categories = typeof payload.categories === "string" ? JSON.parse(payload.categories) : payload.categories;
      } catch (e) {
        categories = payload.categories || [];
      }
    }

    // validate book/chapter if provided
    if (typeof payload.bookId !== "undefined" && payload.bookId) {
      const bookExists = await Book.findById(payload.bookId);
      if (!bookExists) return response(res, false, "Book not found");
      reel.bookId = payload.bookId;
    } else if (typeof payload.bookId !== "undefined" && !payload.bookId) {
      reel.bookId = null;
    }

    if (typeof payload.chapterId !== "undefined" && payload.chapterId) {
      const chExists = await Chapter.findById(payload.chapterId);
      if (!chExists) return response(res, false, "Chapter not found");
      reel.chapterId = payload.chapterId;
    } else if (typeof payload.chapterId !== "undefined" && !payload.chapterId) {
      reel.chapterId = null;
    }

    // validate category ids (optional)
    if (Array.isArray(categories) && categories.length > 0) {
      const validIds = await Category.find({ _id: { $in: categories } }).select("_id").lean();
      const validSet = new Set(validIds.map((c) => c._id.toString()));
      categories = categories.filter((cid) => validSet.has(cid.toString()));
    } else {
      categories = [];
    }

    reel.title = payload.title || reel.title;
    reel.shortDesc = typeof payload.shortDesc !== "undefined" ? payload.shortDesc : reel.shortDesc;
    reel.longDesc = typeof payload.longDesc !== "undefined" ? payload.longDesc : reel.longDesc;
    reel.creatorText = typeof payload.creatorText !== "undefined" ? payload.creatorText : reel.creatorText;
    reel.bookQuoteText = typeof payload.bookQuoteText !== "undefined" ? payload.bookQuoteText : reel.bookQuoteText;
    reel.tags = tags;
    reel.categories = categories;
    reel.active = typeof payload.active !== "undefined" ? (payload.active === "true" || payload.active === true) : reel.active;
    reel.meta = payload.meta ? (typeof payload.meta === "string" ? JSON.parse(payload.meta) : payload.meta) : reel.meta;

    // handle new uploaded media
    const file = req.file;
    if (file) {
      const mapped = mapMediaFile(file);
      reel.mediaPath = mapped.mediaPath;
      reel.mediaType = mapped.mediaType;
      reel.mediaOriginalName = mapped.mediaOriginalName;
      // Note: we don't auto-delete old files here.
    }

    await reel.save();
    const updated = await Reel.findById(reel._id).populate("bookId").populate("chapterId").populate("categories");
    return response(res, true, "Reel updated successfully", updated);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- DELETE REEL --------------------
exports.deleteReel = async (req, res) => {
  try {
    const { id } = req.params;
    const reel = await Reel.findById(id);
    if (!reel) return response(res, false, "Reel not found");
    await reel.deleteOne();
    return response(res, true, "Reel deleted successfully");
  } catch (error) {
    return response(res, false, error.message);
  }
};