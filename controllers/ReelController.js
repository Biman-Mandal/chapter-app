const jwt = require("jsonwebtoken");
const Reel = require("../models/ReelSchema");
const Tag = require("../models/TagSchema");
const User = require("../models/UserSchema");
const { response } = require("../utils/response");

const APP_URL = process.env.APP_URL || "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "secret";

/**
 * Normalize media path to full URL usable on frontend.
 */
const buildMediaUrl = (p = "") => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/")) return `${APP_URL}${p}`;
  return `${APP_URL}/${p}`;
};

/**
 * GET /api/reels/tag-priority
 *
 * Optional Authorization: Bearer <token>
 * Query:
 *   - page (default 1)
 *   - limit (default 20)
 *
 * Behavior:
 *   - If token present and user.chosenTags exists: fetch Tag names for chosenTags, prioritize reels whose tags array contains any of those names (case-insensitive).
 *   - Else: prioritize reels whose tags include "Reels" (case-insensitive).
 *   - Populate bookId, chapterId, categories.
 *   - Return prioritized reels first, then others. Paginate the combined list.
 */
exports.listByUserTags = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.max(1, parseInt(limit, 10) || 20);

    // Step 1: try to get user's chosen tag names if token supplied
    let chosenTagNames = [];

    try {
      const authHeader = req.header("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        if (token) {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded && decoded.userId) {
            const user = await User.findById(decoded.userId).select("chosenTags").lean();
            if (user && Array.isArray(user.chosenTags) && user.chosenTags.length > 0) {
              // chosenTags are Tag ObjectIds; fetch Tag names
              const tags = await Tag.find({ _id: { $in: user.chosenTags } }).select("name").lean();
              chosenTagNames = (tags || []).map((t) => String(t.name).trim()).filter(Boolean);
            }
          }
        }
      }
    } catch (err) {
      // token invalid or user not found -> ignore personalization
      chosenTagNames = [];
    }

    // Step 2: build prioritized set
    // If we have chosenTagNames -> use those, else use ["Reels"]
    const priorityNames = chosenTagNames.length > 0 ? chosenTagNames : ["Reels"];

    // Use case-insensitive match for tag names within reel.tags (array of strings)
    const priorityRegexes = priorityNames.map((n) => new RegExp(`^${escapeRegExp(n)}$`, "i"));

    // Find prioritized reels
    const prioritized = await Reel.find({
      tags: { $in: priorityNames.length === 1 ? priorityRegexes[0] : priorityRegexes },
      active: true,
    })
      .populate("bookId")
      .populate("chapterId")
      .populate("categories")
      .lean();

    // Collect prioritized IDs to exclude from others
    const prioritizedIds = new Set((prioritized || []).map((r) => String(r._id)));

    // Find other reels (active only)
    const others = await Reel.find({
      _id: { $nin: Array.from(prioritizedIds) },
      active: true,
    })
      .populate("bookId")
      .populate("chapterId")
      .populate("categories")
      .lean();

    // Combine and paginate
    const combined = [...(prioritized || []), ...(others || [])];
    const total = combined.length;
    const start = (p - 1) * lim;
    const pageItems = combined.slice(start, start + lim);

    // Format items for frontend: populate safe fields and build full mediaPath
    const formatted = (pageItems || []).map((r) => {
      const book = r.bookId
        ? {
            id: r.bookId._id ? String(r.bookId._id) : String(r.bookId),
            title: r.bookId.title || "",
            author: r.bookId.author || "",
            shortDesc: r.bookId.shortDesc || "",
            coverImage: r.bookId.coverImage ? buildMediaUrl(r.bookId.coverImage) : "",
          }
        : null;

      const chapter = r.chapterId
        ? {
            id: r.chapterId._id ? String(r.chapterId._id) : String(r.chapterId),
            title: r.chapterId.title || "",
            duration: r.chapterId.duration || "",
          }
        : null;

      const categories = Array.isArray(r.categories)
        ? r.categories.map((c) => ({
            id: c._id ? String(c._id) : String(c),
            name: c.name || "",
            slug: c.slug || "",
            image: c.image ? buildMediaUrl(c.image) : "",
          }))
        : [];

      return {
        id: r._id ? String(r._id) : "",
        title: r.title || "",
        shortDesc: r.shortDesc || "",
        longDesc: r.longDesc || "",
        creatorText: r.creatorText || "",
        book,
        chapter,
        bookQuoteText: r.bookQuoteText || "",
        tags: Array.isArray(r.tags) ? r.tags : [],
        categories,
        mediaPath: r.mediaPath ? buildMediaUrl(r.mediaPath) : "",
        mediaType: r.mediaType || "",
        mediaOriginalName: r.mediaOriginalName || "",
        meta: r.meta || {},
        active: !!r.active,
        createdAt: r.createdAt || "",
        updatedAt: r.updatedAt || "",
      };
    });

    return res.status(200).json({
      status: true,
      message: "Reels fetched (tag-priority)",
      data: {
        items: formatted,
        total,
        page: p,
        perPage: lim,
        totalPages: Math.max(1, Math.ceil(total / lim)),
      },
    });
  } catch (error) {
    console.error("Reel tag-priority error:", error);
    return response(res, false, error.message || "Failed to fetch prioritized reels");
  }
};

/**
 * Escape regex special characters in a string.
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}