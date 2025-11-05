const mongoose = require("mongoose");

const OptionSchema = new mongoose.Schema(
  {
    id: { type: String }, // frontend uuid
    text: { type: String, default: "" },
    value: { type: String, default: "" },
    // media fields now stored as server paths (relative URL)
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
    description: { type: String, default: "" }, // newly added description field
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