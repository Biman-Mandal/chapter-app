const mongoose = require("mongoose");

const ReelSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    shortDesc: { type: String, default: "" },
    longDesc: { type: String, default: "" },
    creatorText: { type: String, default: "" },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: false },
    bookQuoteText: { type: String, default: "" },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: false },
    tags: { type: [String], default: [] },
    // categories stored as ObjectId references to categories collection
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "categories" }],
    mediaPath: { type: String, default: "" },
    mediaType: { type: String, enum: ["image", "video", "audio", ""], default: "" },
    mediaOriginalName: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reel", ReelSchema);