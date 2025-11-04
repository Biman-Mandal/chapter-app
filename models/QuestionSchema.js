const mongoose = require("mongoose");

const OptionSchema = new mongoose.Schema(
  {
    id: { type: String }, // for frontend mapping (uuid)
    text: { type: String, default: "" },
    value: { type: String, default: "" },
    image: { type: String, default: "" },
    video: { type: String, default: "" },
    order: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const QuestionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    // types: single, multiple, dropdown, grid, text, image, video
    type: {
      type: String,
      enum: ["single", "multiple", "dropdown", "grid", "text", "image", "video"],
      required: true,
      default: "single",
    },
    options: { type: [OptionSchema], default: [] },
    required: { type: Boolean, default: false },
    section: { type: String, default: "" }, // e.g., "Interests", "Personality"
    order: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", QuestionSchema);