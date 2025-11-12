const Chapter = require("../../models/ChapterSchema");
const Book = require("../../models/BookSchema");
const { response } = require("../../utils/response");
const path = require("path");

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

// -------------------- LIST CHAPTERS --------------------
exports.chapterList = async (req, res) => {
  try {
    const { bookId, page = 1, limit = 50, search } = req.query;
    const q = {};
    if (bookId) q.bookId = bookId;
    if (search) {
      q.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortDesc: { $regex: search, $options: "i" } },
        { longDesc: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const items = await Chapter.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Chapter.countDocuments(q);
    return response(res, true, "Chapters fetched", { items, total });
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- GET SINGLE CHAPTER --------------------
exports.getChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const ch = await Chapter.findById(id);
    if (!ch) return response(res, false, "Chapter not found");
    return response(res, true, "Chapter fetched", ch);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- CREATE CHAPTER --------------------
exports.createChapter = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.title) return response(res, false, "Title is required");
    if (!payload.bookId) return response(res, false, "bookId is required");

    // ensure book exists
    const book = await Book.findById(payload.bookId);
    if (!book) return response(res, false, "Book not found");

    const file = req.file; // upload.single('media')
    const mapped = mapMediaFile(file);

    const ch = await Chapter.create({
      bookId: payload.bookId,
      title: payload.title,
      shortDesc: payload.shortDesc || "",
      longDesc: payload.longDesc || "",
      duration: payload.duration || "",
      mediaPath: mapped.mediaPath || payload.mediaPath || "",
      mediaType: mapped.mediaType || "",
      mediaOriginalName: mapped.mediaOriginalName || "",
      meta: payload.meta ? (typeof payload.meta === "string" ? JSON.parse(payload.meta) : payload.meta) : {},
      createdBy: req.user ? req.user._id : undefined,
    });

    return response(res, true, "Chapter created successfully", ch);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- UPDATE CHAPTER --------------------
exports.updateChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const ch = await Chapter.findById(id);
    if (!ch) return response(res, false, "Chapter not found");

    if (payload.title) ch.title = payload.title;
    if (typeof payload.shortDesc !== "undefined") ch.shortDesc = payload.shortDesc;
    if (typeof payload.longDesc !== "undefined") ch.longDesc = payload.longDesc;
    if (typeof payload.duration !== "undefined") ch.duration = payload.duration;
    if (typeof payload.active !== "undefined") ch.active = payload.active === "true" || payload.active === true;

    // handle new uploaded media
    const file = req.file;
    if (file) {
      const mapped = mapMediaFile(file);
      // Note: we don't auto-delete old file here; addons for cleanup can be implemented.
      ch.mediaPath = mapped.mediaPath;
      ch.mediaType = mapped.mediaType;
      ch.mediaOriginalName = mapped.mediaOriginalName;
    }

    ch.meta = payload.meta ? (typeof payload.meta === "string" ? JSON.parse(payload.meta) : payload.meta) : ch.meta;

    await ch.save();
    return response(res, true, "Chapter updated successfully", ch);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- DELETE CHAPTER --------------------
exports.deleteChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const ch = await Chapter.findById(id);
    if (!ch) return response(res, false, "Chapter not found");
    await ch.deleteOne();
    return response(res, true, "Chapter deleted successfully");
  } catch (error) {
    return response(res, false, error.message);
  }
};