const mongoose = require("mongoose");
const Chapter = require("../models/ChapterSchema");
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

/**
 * POST /api/progress
 * Body:
 *  { bookId, chapterId, playedSeconds, durationSeconds? , metadata?: { userIdentifier?: 'guest-abc' } }
 *
 * Behavior:
 *  - Upsert a ChapterProgress record for the user (from token) or guest (metadata.userIdentifier or header X-Guest-Identifier)
 *  - Compute percent and completed flag (>=95% or playedSeconds >= durationSeconds)
 *  - Return saved progress and guestIdentifier (if guest)
 */
exports.record = async (req, res) => {
  try {
    const { bookId, chapterId } = req.body || {};
    let { playedSeconds = 0, durationSeconds } = req.body || {};

    if (!bookId || !chapterId) return response(res, false, "bookId and chapterId are required");

    const chapter = await Chapter.findById(chapterId).lean();
    if (!chapter) return response(res, false, "Chapter not found");

    if (!durationSeconds || Number(durationSeconds) <= 0) {
      const parsed = parseDurationToSeconds(chapter.duration);
      durationSeconds = parsed || Number(durationSeconds) || 0;
    } else {
      durationSeconds = Number(durationSeconds);
    }

    playedSeconds = Number(playedSeconds || 0);

    const percent = durationSeconds > 0 ? Math.min(100, (playedSeconds / durationSeconds) * 100) : 0;
    const completed = percent >= 95 || (durationSeconds > 0 && playedSeconds + 1 >= durationSeconds);

    const authUser = getUserFromAuthHeader(req);

    // identify guest identifier
    let guestIdentifier = null;
    let metadata = req.body.metadata || {};
    if (!authUser) {
      guestIdentifier = metadata.userIdentifier || req.header("X-Guest-Identifier") || req.body.guestIdentifier || null;
      if (!guestIdentifier) {
        // generate one and return to client
        guestIdentifier = require("crypto").randomBytes(12).toString("hex");
      }
      metadata.userIdentifier = guestIdentifier;
    }

    const filter = {
        bookId,
        chapterId
    };
    if (authUser) filter.userId = authUser.userId;
    else filter["metadata.userIdentifier"] = metadata.userIdentifier;

    const update = {
      $set: {
        playedSeconds,
        durationSeconds,
        percent: Math.round(percent * 100) / 100,
        completed,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        bookId: bookId,
        chapterId: chapterId,
      },
    };

    if (authUser) update.$set.userId = authUser.userId;
    else update.$set.metadata = { userIdentifier: metadata.userIdentifier };

    await ChapterProgress.findOneAndUpdate(filter, update, { upsert: true, setDefaultsOnInsert: true });

    const saved = await ChapterProgress.findOne(filter).lean();

    return response(res, true, "Progress recorded", { progress: saved, guestIdentifier: guestIdentifier || null });
  } catch (err) {
    console.log(err)
    return response(res, false, err.message);
  }
};

/**
 * GET /api/progress/book/:bookId
 * Query:
 *   - guestIdentifier (optional for guests) or Authorization Bearer for user
 * Returns per-chapter progress and overall summary for the specified book for the requester.
 */
exports.bookProgress = async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!bookId) return response(res, false, "bookId required");

    const authUser = getUserFromAuthHeader(req);
    let guestIdentifier = null;
    if (!authUser) {
      guestIdentifier = req.query.guestIdentifier || req.header("X-Guest-Identifier") || null;
      if (!guestIdentifier) return response(res, false, "guestIdentifier required for unauthenticated requests");
    }

    const chapters = await Chapter.find({ bookId: bookId }).sort({ createdAt: 1 }).lean();
    const chapIds = chapters.map((c) => c._id);

    const filter = { chapterId: { $in: chapIds }, bookId: bookId };
    if (authUser) filter.userId = authUser.userId;
    else filter["metadata.userIdentifier"] = guestIdentifier;

    const progresses = await ChapterProgress.find(filter).lean();
    const progMap = new Map();
    for (const p of progresses) progMap.set(String(p.chapterId), p);

    const perChapter = chapters.map((ch) => {
      const p = progMap.get(String(ch._id)) || null;
      const dur = parseDurationToSeconds(ch.duration) || (p ? p.durationSeconds || 0 : 0);
      return {
        chapterId: ch._id,
        title: ch.title,
        durationSeconds: dur,
        playedSeconds: p ? p.playedSeconds || 0 : 0,
        percent: p ? Math.round((p.percent || 0) * 100) / 100 : 0,
        completed: p ? !!p.completed : false,
        updatedAt: p ? p.updatedAt || p.createdAt : null,
      };
    });

    const totalChapters = perChapter.length;
    const completedChapters = perChapter.filter((c) => c.completed).length;
    const overallPercent = totalChapters ? Math.round((perChapter.reduce((a, b) => a + (b.percent || 0), 0) / totalChapters) * 100) / 100 : 0;

    return response(res, true, "Book progress fetched", { perChapter, overall: { totalChapters, completedChapters, percent: overallPercent } });
  } catch (err) {
    console.log(err)
    return response(res, false, err.message);
  }
};