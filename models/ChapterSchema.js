const mongoose = require("mongoose");

const ChapterSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    title: { type: String, required: true, trim: true },
    shortDesc: { type: String, default: "" },
    longDesc: { type: String, default: "" },
    duration: { type: String, default: "" }, // e.g. "08:32"
    // media stored as server path (relative URL), with type to help UI
    mediaPath: { type: String, default: "" },
    mediaType: { type: String, enum: ["image", "video", "audio", ""], default: "" },
    mediaOriginalName: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chapter", ChapterSchema);