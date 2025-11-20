const mongoose = require("mongoose");
const Book = require("../models/BookSchema");
const Chapter = require("../models/ChapterSchema");
const User = require("../models/UserSchema");
const Tag = require("../models/TagSchema");
const ChapterProgress = require("../models/ChapterProgress");

// format seconds -> HH:MM:SS
const formatSeconds = (sec) => {
  if (!sec || sec <= 0) return "00:00:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [
    String(h).padStart(2, "0"),
    String(m).padStart(2, "0"),
    String(s).padStart(2, "0"),
  ].join(":");
};

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
 *      - book_progress  => return ONLY books where the authenticated user has progress AND the book is NOT completed (continue reading)
 *      - completed_books => return ONLY books which the authenticated user has completed
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
    const active = true;

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
    if (category && String(category)) {
      baseFilter.categories = category;
    }

    // Determine flags
    const wantRelated = String(type) === "related_books";
    const wantProgress = String(type) === "book_progress";
    const wantCompleted = String(type) === "completed_books";

    // Resolve requestedTagNames either from query or from user's chosenTags (if token present and related requested)
    let requestedTagNames = await resolveTagNamesFromQuery(tagQuery);

    // Use auth middleware provided user (req.user). The app routes should ensure auth middleware is used when required.
    const authUser = req.user || null;

    if (wantRelated && requestedTagNames.length === 0 && authUser) {
      const user = await User.findById(authUser.userId).lean();
      if (user && Array.isArray(user.chosenTags) && user.chosenTags.length > 0) {
        const tagDocs = await Tag.find({ _id: { $in: user.chosenTags } }).lean();
        requestedTagNames = tagDocs.map((t) => String(t.name));
      }
    }

    requestedTagNames = Array.from(new Set((requestedTagNames || []).map((t) => String(t).trim()).filter(Boolean)));

    // If requesting user's progress-related lists, require authentication
    if ((wantProgress || wantCompleted) && !authUser) {
      return response(res, false, "Authentication required for this request");
    }

    // BOOK_PROGRESS flow: return only books where user has progress and the book is not completed
    if (wantProgress) {
      const userId = authUser.userId

      // Fetch all progresses for this user
      const progresses = await ChapterProgress.find({ userId }).lean();

      if (!progresses || progresses.length === 0) {
        return response(res, true, "Books fetched", { items: [], total: 0, perPage: perPageNum, currentPage: pageNum });
      }

      // Group progresses by bookId
      const progressesByBook = new Map();
      for (const p of progresses) {
        const bid = String(p.bookId);
        if (!progressesByBook.has(bid)) progressesByBook.set(bid, []);
        progressesByBook.get(bid).push(p);
      }

      const bookIds = Array.from(progressesByBook.keys()).filter((id) => id).map((id) => id);
      if (bookIds.length === 0) {
        return response(res, true, "Books fetched", { items: [], total: 0, perPage: perPageNum, currentPage: pageNum });
      }

      // Fetch chapters for these books
      const chapters = await Chapter.find({ bookId: { $in: bookIds } }).select("_id bookId duration").lean();

      // build chapters by book map
      const chaptersByBook = new Map();
      for (const c of chapters) {
        const bid = String(c.bookId);
        if (!chaptersByBook.has(bid)) chaptersByBook.set(bid, []);
        chaptersByBook.get(bid).push(c);
      }

      // Decide which books are "not completed" (continue reading): overall percent < 95
      const candidateBookIds = [];
      const bookProgressSummary = new Map(); // bookId -> { totalCh, completedCh, percent }

      for (const bidObj of bookIds) {
        const bid = String(bidObj);
        const chs = chaptersByBook.get(bid) || [];
        const totalCh = chs.length;

        // sum percent using user's progresses; missing chapters count as 0
        const userProgressesForBook = progressesByBook.get(bid) || [];
        const progressByChapter = new Map();
        for (const p of userProgressesForBook) progressByChapter.set(String(p.chapterId), p);

        let sumPercent = 0;
        let completedCh = 0;

        for (const ch of chs) {
          const p = progressByChapter.get(String(ch._id));
          if (p) {
            sumPercent += Number(p.percent || 0);
            if (p.completed) completedCh++;
          } else {
            sumPercent += 0;
          }
        }

        const overallPercent = totalCh > 0 ? (sumPercent / (totalCh || 1)) : 0;
        bookProgressSummary.set(bid, { totalChapters: totalCh, completedChapters: completedCh, percent: Math.round(overallPercent * 100) / 100 });

        // keep only those books with at least one progress and overall percent < 95 (not completed)
        const hasAnyProgress = (userProgressesForBook && userProgressesForBook.length > 0);
        if (hasAnyProgress && overallPercent < 95) {
          candidateBookIds.push(bid);
        }
      }

      if (candidateBookIds.length === 0) {
        return response(res, true, "Books fetched", { items: [], total: 0, perPage: perPageNum, currentPage: pageNum });
      }

      // Fetch book documents for candidateBookIds
      const books = await Book.find({ _id: { $in: candidateBookIds }, ...baseFilter }).sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 }).lean();

      // attach progress summary & chapterCount
      const items = books.map((b) => {
        const bid = String(b._id);
        const summary = bookProgressSummary.get(bid) || { totalChapters: 0, completedChapters: 0, percent: 0 };
        return { ...b, chapterCount: summary.totalChapters || 0, progress: summary };
      });

      const total = items.length;
      // paginate items
      const start = (pageNum - 1) * perPageNum;
      const slice = items.slice(start, start + perPageNum);

      return response(res, true, "Books fetched (continue reading)", { items: slice, total, perPage: perPageNum, currentPage: pageNum });
    }

    // COMPLETED_BOOKS flow: return only books which the user has completed reading
    if (wantCompleted) {
      const userId = authUser.userId;

      const progresses = await ChapterProgress.find({ userId }).lean();
      if (!progresses || progresses.length === 0) {
        return response(res, true, "Books fetched", { items: [], total: 0, perPage: perPageNum, currentPage: pageNum });
      }

      const progressesByBook = new Map();
      for (const p of progresses) {
        const bid = String(p.bookId);
        if (!progressesByBook.has(bid)) progressesByBook.set(bid, []);
        progressesByBook.get(bid).push(p);
      }

      const bookIds = Array.from(progressesByBook.keys()).filter((id) => id).map((id) => id);
      if (bookIds.length === 0) {
        return response(res, true, "Books fetched", { items: [], total: 0, perPage: perPageNum, currentPage: pageNum });
      }

      // Fetch chapters for these books
      const chapters = await Chapter.find({ bookId: { $in: bookIds } }).select("_id bookId duration").lean();

      const chaptersByBook = new Map();
      for (const c of chapters) {
        const bid = String(c.bookId);
        if (!chaptersByBook.has(bid)) chaptersByBook.set(bid, []);
        chaptersByBook.get(bid).push(c);
      }

      const completedBookIds = [];
      const bookProgressSummary = new Map();

      for (const bidObj of bookIds) {
        const bid = String(bidObj);
        const chs = chaptersByBook.get(bid) || [];
        const totalCh = chs.length;

        const userProgressesForBook = progressesByBook.get(bid) || [];
        const progressByChapter = new Map();
        for (const p of userProgressesForBook) progressByChapter.set(String(p.chapterId), p);

        let sumPercent = 0;
        let completedCh = 0;

        for (const ch of chs) {
          const p = progressByChapter.get(String(ch._id));
          if (p) {
            sumPercent += Number(p.percent || 0);
            if (p.completed) completedCh++;
          } else {
            sumPercent += 0;
          }
        }

        const overallPercent = totalCh > 0 ? (sumPercent / (totalCh || 1)) : 0;
        const rounded = Math.round(overallPercent * 100) / 100;
        bookProgressSummary.set(bid, { totalChapters: totalCh, completedChapters: completedCh, percent: rounded });

        // Consider book completed if overallPercent >= 95 AND there was at least one progress
        const hasAnyProgress = (userProgressesForBook && userProgressesForBook.length > 0);
        if (hasAnyProgress && overallPercent >= 95) {
          completedBookIds.push(bid);
        }
      }

      if (completedBookIds.length === 0) {
        return response(res, true, "Books fetched", { items: [], total: 0, perPage: perPageNum, currentPage: pageNum });
      }

      const books = await Book.find({ _id: { $in: completedBookIds }, ...baseFilter }).sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 }).lean();

      const items = books.map((b) => {
        const bid = String(b._id);
        const summary = bookProgressSummary.get(bid) || { totalChapters: 0, completedChapters: 0, percent: 0 };
        return { ...b, chapterCount: summary.totalChapters || 0, progress: summary };
      });

      const total = items.length;
      const start = (pageNum - 1) * perPageNum;
      const slice = items.slice(start, start + perPageNum);

      return response(res, true, "Books fetched (completed)", { items: slice, total, perPage: perPageNum, currentPage: pageNum });
    }

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

    return response(res, true, "Books fetched (related prioritized)", { items, total, perPage: perPageNum, currentPage: pageNum, relatedTags: requestedTagNames });
  } catch (err) {
    console.log(err)
    return response(res, false, err.message);
  }
};

/**
 * GET /api/books/:id
 * Returns book details with chapters. If authenticated (Authorization Bearer) provided,
 * returns per-chapter progress as well and an overall progress summary.
 */
exports.getDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return response(res, false, "book id required");

    const book = await Book.findById(id).populate("categories").lean();
    if (!book) return response(res, false, "Book not found");

    const chapters = await Chapter.find({ bookId: book._id }).sort({ createdAt: 1 }).lean();

    // identify user from auth middleware
    const auth = req.user || null;

    let progressMap = new Map();
    if (auth) {
      const filter = { bookId: book._id, chapterId: { $in: chapters.map((c) => c._id) } };
      filter.userId = auth.userId;
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