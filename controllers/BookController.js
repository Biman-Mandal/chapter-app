const mongoose = require("mongoose");
const Book = require("../models/BookSchema");
const Chapter = require("../models/ChapterSchema");
const User = require("../models/UserSchema");
const Tag = require("../models/TagSchema");
const ChapterProgress = require("../models/ChapterProgress");
const { getUserFromAuthHeader } = require("../utils/authHelper");

// uniform response helper
const response = (res, status, message, data = {}) => {
  return res.status(status ? 200 : 400).json({
    status,
    message: message || "",
    data,
  });
};

const parseDurationToSeconds = (d) => {
  if (d == null) return 0;
  if (typeof d === "number") return d;
  const s = String(d).trim();
  if (!s) return 0;
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
};

const resolveTagNamesFromQuery = async (tagQuery) => {
  const tagNames = [];
  if (!tagQuery) return tagNames;
  try {
    const parsed = typeof tagQuery === "string" ? JSON.parse(tagQuery) : tagQuery;
    if (Array.isArray(parsed)) {
      const ids = parsed.filter((p) => typeof p === "string" && /^[0-9a-fA-F]{24}$/.test(p));
      const names = parsed.filter((p) => !(typeof p === "string" && /^[0-9a-fA-F]{24}$/.test(p))).map(String);
      if (ids.length > 0) {
        const tagDocs = await Tag.find({ _id: { $in: ids } }).lean();
        tagNames.push(...tagDocs.map((t) => String(t.name)));
      }
      if (names.length > 0) tagNames.push(...names);
    } else if (typeof parsed === "string") {
      tagNames.push(...parsed.split(",").map((s) => s.trim()).filter(Boolean));
    }
  } catch (err) {
    tagNames.push(...String(tagQuery).split(",").map((s) => s.trim()).filter(Boolean));
  }
  return Array.from(new Set(tagNames));
};

/**
 * GET /api/books
 *
 * Query params:
 *  - search, author, category (id), tag (names or ids), active
 *  - sortBy, sortOrder
 *  - page, perPage
 *  - type:
 *      - related_books  => prioritize books matching tags (from tag query or user's chosenTags if token provided)
 *      - book_progress  => include per-book progress summary for requester (if token or guestIdentifier provided)
 *      - default listing
 *
 * Response format (uniform):
 *  { status: true, message, data: { items: [books], total, perPage, currentPage } }
 */
exports.list = async (req, res) => {
  try {
    const {
      search,
      author,
      category,
      tag: tagQuery,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      perPage = 20,
      type,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const perPageNum = Math.min(Math.max(1, Number(perPage) || 20), 200);

    const baseFilter = {};
    const active = true

    if (search) {
      const re = new RegExp(search, "i");
      baseFilter.$or = [
        { title: { $regex: re } },
        { shortDesc: { $regex: re } },
        { longDesc: { $regex: re } },
        { author: { $regex: re } },
      ];
    }

    if (author) baseFilter.author = author;
    if (category && mongoose.Types.ObjectId.isValid(String(category))) {
      baseFilter.categories = mongoose.Types.ObjectId(category);
    }

    // Determine flags
    const wantRelated = String(type) === "related_books";
    const wantProgress = String(type) === "book_progress";

    // Resolve requestedTagNames either from query or from user's chosenTags (if token present and related requested)
    let requestedTagNames = await resolveTagNamesFromQuery(tagQuery);

    const authUser = getUserFromAuthHeader(req);

    if (wantRelated && requestedTagNames.length === 0 && authUser) {
      const user = await User.findById(authUser.userId).lean();
      if (user && Array.isArray(user.chosenTags) && user.chosenTags.length > 0) {
        const tagDocs = await Tag.find({ _id: { $in: user.chosenTags } }).lean();
        requestedTagNames = tagDocs.map((t) => String(t.name));
      }
    }

    requestedTagNames = Array.from(new Set((requestedTagNames || []).map((t) => String(t).trim()).filter(Boolean)));

    // If not related prioritization or no tags resolved -> normal DB pagination
    if (!wantRelated || requestedTagNames.length === 0) {
      const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
      const skip = (pageNum - 1) * perPageNum;

      const [total, docs] = await Promise.all([
        Book.countDocuments(baseFilter),
        Book.find(baseFilter).sort(sort).skip(skip).limit(perPageNum).lean(),
      ]);

      // Get chapter counts for the page items
      const counts = await Promise.all(docs.map((b) => Chapter.countDocuments({ bookId: b._id })));

      const items = docs.map((b, i) => {
        const out = { ...b, chapterCount: counts[i] || 0, _matchedTags: [] };
        return out;
      });

      // If book_progress requested, and requester present (auth or guestIdentifier), add per-book progress summary
      if (wantProgress) {
        const identifier = authUser ? { userId: authUser.userId } : { guestIdentifier: req.query.guestIdentifier || req.header("X-Guest-Identifier") || null };
        if (identifier.userId || identifier.guestIdentifier) {
          const bookIds = items.map((it) => it._id);
          // fetch chapters & progresses for these books
          const chapters = await Chapter.find({ bookId: { $in: bookIds } }).select("_id bookId duration").lean();
          const chapIds = chapters.map((c) => c._id);
          const progressFilter = { chapterId: { $in: chapIds } };
          if (identifier.userId) progressFilter.userId = identifier.userId;
          else progressFilter["metadata.userIdentifier"] = identifier.guestIdentifier;

          const progresses = await ChapterProgress.find(progressFilter).lean();
          // map by bookId
          const chaptersByBook = new Map();
          for (const c of chapters) {
            const bid = String(c.bookId);
            if (!chaptersByBook.has(bid)) chaptersByBook.set(bid, []);
            chaptersByBook.get(bid).push(c);
          }
          const progressByChapter = new Map();
          for (const p of progresses) progressByChapter.set(String(p.chapterId), p);

          // compute summary per book
          items.forEach((it) => {
            const bid = String(it._id);
            const chs = chaptersByBook.get(bid) || [];
            const totalCh = chs.length;
            let completedCh = 0;
            let sumPercent = 0;
            chs.forEach((c) => {
              const p = progressByChapter.get(String(c._id));
              if (p) {
                sumPercent += Number(p.percent || 0);
                if (p.completed) completedCh++;
              } else {
                sumPercent += 0;
              }
            });
            const overallPercent = totalCh > 0 ? Math.round((sumPercent / totalCh) * 100) / 100 : 0;
            it.progress = { totalChapters: totalCh, completedChapters: completedCh, percent: overallPercent };
          });
        }
      }

      return response(res, true, "Books fetched", { items, total, perPage: perPageNum, currentPage: pageNum });
    }

    // RELATED flow: get matched & other, combine with matched first
    const matchedQuery = { ...baseFilter, tags: { $in: requestedTagNames } };
    const othersQuery = { ...baseFilter, $or: [{ tags: { $exists: false } }, { tags: { $nin: requestedTagNames } }] };

    const [matchedDocs, otherDocs] = await Promise.all([
      Book.find(matchedQuery).sort({ createdAt: -1 }).lean(),
      Book.find(othersQuery).sort({ createdAt: -1 }).lean(),
    ]);

    const combined = [...matchedDocs, ...otherDocs];
    const total = combined.length;
    const start = (pageNum - 1) * perPageNum;
    const slice = combined.slice(start, start + perPageNum);

    // fetch chapter counts for page slice
    const counts = await Promise.all(slice.map((b) => Chapter.countDocuments({ bookId: b._id })));

    const items = slice.map((b, i) => {
      const matched = Array.isArray(b.tags) ? b.tags.filter((t) => requestedTagNames.includes(String(t))) : [];
      return { ...b, chapterCount: counts[i] || 0, _matchedTags: matched };
    });

    // if book_progress requested include progress summaries for these page items
    if (wantProgress) {
      const identifier = getUserFromAuthHeader(req);
      const guestIdentifier = identifier ? null : (req.query.guestIdentifier || req.header("X-Guest-Identifier") || null);
      if (identifier || guestIdentifier) {
        const bookIds = items.map((it) => it._id);
        const chapters = await Chapter.find({ bookId: { $in: bookIds } }).select("_id bookId duration").lean();
        const chapIds = chapters.map((c) => c._id);
        const progressFilter = { chapterId: { $in: chapIds } };
        if (identifier) progressFilter.userId = mongoose.Types.ObjectId(identifier.userId);
        else progressFilter["metadata.userIdentifier"] = guestIdentifier;

        const progresses = await ChapterProgress.find(progressFilter).lean();
        const chaptersByBook = new Map();
        for (const c of chapters) {
          const bid = String(c.bookId);
          if (!chaptersByBook.has(bid)) chaptersByBook.set(bid, []);
          chaptersByBook.get(bid).push(c);
        }
        const progressByChapter = new Map();
        for (const p of progresses) progressByChapter.set(String(p.chapterId), p);

        items.forEach((it) => {
          const bid = String(it._id);
          const chs = chaptersByBook.get(bid) || [];
          const totalCh = chs.length;
          let completedCh = 0;
          let sumPercent = 0;
          chs.forEach((c) => {
            const p = progressByChapter.get(String(c._id));
            if (p) {
              sumPercent += Number(p.percent || 0);
              if (p.completed) completedCh++;
            } else {
              sumPercent += 0;
            }
          });
          const overallPercent = totalCh > 0 ? Math.round((sumPercent / totalCh) * 100) / 100 : 0;
          it.progress = { totalChapters: totalCh, completedChapters: completedCh, percent: overallPercent };
        });
      }
    }

    return response(res, true, "Books fetched (related prioritized)", { items, total, perPage: perPageNum, currentPage: pageNum, relatedTags: requestedTagNames });
  } catch (err) {
    console.log(err)
    return response(res, false, err.message);
  }
};

/**
 * GET /api/books/:id
 * Returns book details with chapters. If authenticated (Authorization Bearer) or guestIdentifier provided,
 * returns per-chapter progress as well and an overall progress summary.
 */
exports.getDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return response(res, false, "book id required");

    const book = await Book.findById(id).populate("categories").lean();
    if (!book) return response(res, false, "Book not found");

    const chapters = await Chapter.find({ bookId: book._id }).sort({ createdAt: 1 }).lean();

    // identify user or guest
    const auth = getUserFromAuthHeader(req);
    const guestIdentifier = auth ? null : (req.query.guestIdentifier || req.header("X-Guest-Identifier") || null);

    let progressMap = new Map();
    if (auth || guestIdentifier) {
      const filter = { bookId: book._id, chapterId: { $in: chapters.map((c) => c._id) } };
      if (auth) filter.userId = mongoose.Types.ObjectId(auth.userId);
      else filter["metadata.userIdentifier"] = guestIdentifier;
      const progresses = await ChapterProgress.find(filter).lean();
      for (const p of progresses) progressMap.set(String(p.chapterId), p);
    }

    const chaptersWithProgress = chapters.map((ch) => {
      const dur = parseDurationToSeconds(ch.duration);
      const p = progressMap.get(String(ch._id)) || null;
      return {
        ...ch,
        durationSeconds: dur || (p ? p.durationSeconds : 0),
        progress: p
          ? {
              playedSeconds: p.playedSeconds || 0,
              durationSeconds: p.durationSeconds || 0,
              percent: Math.round((p.percent || 0) * 100) / 100,
              completed: !!p.completed,
              updatedAt: p.updatedAt || p.createdAt || null,
            }
          : { playedSeconds: 0, durationSeconds: dur || 0, percent: 0, completed: false, updatedAt: null },
      };
    });

    const totalChapters = chaptersWithProgress.length;
    const completedChapters = chaptersWithProgress.filter((c) => c.progress && c.progress.completed).length;
    const overallPercent = totalChapters
      ? Math.round((chaptersWithProgress.reduce((sum, c) => sum + (c.progress.percent || 0), 0) / totalChapters) * 100) / 100
      : 0;

    const data = {
      ...book,
      chapters: chaptersWithProgress,
      chapterCount: totalChapters,
      overallProgress: { totalChapters, completedChapters, percent: overallPercent },
    };

    return response(res, true, "Book details fetched", data);
  } catch (err) {
    return response(res, false, err.message);
  }
};