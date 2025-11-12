const mongoose = require("mongoose");

const AnswerItemSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
    // For single/multiple/dropdown: array of option ids or values
    values: { type: [String], default: [] },
    // For text responses, we store the free text here
    text: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const ResponseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: false }, // optional if guest allowed
    answers: { type: [AnswerItemSchema], required: true, default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // device, ip, session id etc.
  },
  { timestamps: true }
);

module.exports = mongoose.model("Response", ResponseSchema);