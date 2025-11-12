const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    quote: { type: String, default: "" },
    shortDesc: { type: String, default: "" },
    longDesc: { type: String, default: "" },
    coverImage: { type: String, default: "" }, // stored as relative server path e.g. /uploads/books/...
    backgroundImage: { type: String, default: "" },
    tags: { type: [String], default: [] },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Book", BookSchema);