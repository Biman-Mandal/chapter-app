const mongoose = require("mongoose");

const chapterProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { userIdentifier: 'guest-abc' }
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
    playedSeconds: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
    percent: { type: Number, default: 0 }, // 0-100
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChapterProgress", chapterProgressSchema);