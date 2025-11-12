const Question = require("../../models/QuestionSchema");
const Response = require("../../models/ResponseSchema");
const { response } = require("../../utils/response");
const path = require("path");
const mongoose = require("mongoose");

// helper: map uploaded files to options (expects files array in order matching options array)
const attachFilesToOptions = (options = [], files = []) => {
  if (!Array.isArray(options)) return options;
  if (!Array.isArray(files) || files.length === 0) return options;

  // If number of files <= options length, we map by index. Otherwise, we try to match by originalname hint.
  return options.map((opt, idx) => {
    const newOpt = { ...opt };
    const file = files[idx];
    if (file) {
      // determine if image or video by mimetype
      if (file.mimetype.startsWith("image/")) {
        newOpt.image = `/uploads/${file.filename}`;
        newOpt.video = newOpt.video || "";
      } else if (file.mimetype.startsWith("video/")) {
        newOpt.video = `/uploads/${file.filename}`;
        newOpt.image = newOpt.image || "";
      }
    }
    return newOpt;
  });
};

// -------------------- LIST QUESTIONS --------------------
exports.questionList = async (req, res) => {
  try {
    const { search, section, active } = req.query;
    const query = {};
    if (search) query.title = { $regex: search, $options: "i" };
    if (section) query.section = section;
    if (typeof active !== "undefined") query.active = active === "true";

    const questions = await Question.find(query).sort({ order: 1, createdAt: -1 });
    return response(res, true, "Question list fetched successfully", questions);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- GET SINGLE QUESTION --------------------
exports.getQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);
    if (!question) return response(res, false, "Question not found");
    return response(res, true, "Question fetched", question);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- CREATE QUESTION --------------------
exports.createQuestion = async (req, res) => {
  try {
    const payload = req.body || {};
    let options = [];
    if (payload.options) {
      try {
        options = typeof payload.options === "string" ? JSON.parse(payload.options) : payload.options;
      } catch (err) {
        options = [];
      }
    } else {
      options = [];
    }

    // attach uploaded files (if any)
    const files = req.files || [];
    const finalOptions = attachFilesToOptions(options, files);

    // parse tags if present
    let tags = [];
    if (payload.tags) {
      try {
        tags = typeof payload.tags === "string" ? JSON.parse(payload.tags) : payload.tags;
      } catch (e) {
        tags = payload.tags || [];
      }
    }

    const q = await Question.create({
      title: payload.title,
      description: payload.description || "",
      type: payload.type,
      options: finalOptions,
      required: payload.required === "true" || payload.required === true,
      section: payload.section || "",
      order: payload.order ? Number(payload.order) : 0,
      meta: payload.meta ? (typeof payload.meta === "string" ? JSON.parse(payload.meta) : payload.meta) : {},
      createdBy: req.user ? req.user._id : undefined,
      tags,
    });

    return response(res, true, "Question created successfully", q);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- UPDATE QUESTION --------------------
exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    const question = await Question.findById(id);
    if (!question) return response(res, false, "Question not found");

    // parse options if stringified
    let options = [];
    if (typeof payload.options !== "undefined") {
      try {
        options = typeof payload.options === "string" ? JSON.parse(payload.options) : payload.options;
      } catch (err) {
        options = payload.options || [];
      }
    } else {
      options = question.options || [];
    }

    // attach new uploaded files (if any) — map by index of provided options
    const files = req.files || [];
    const finalOptions = attachFilesToOptions(options, files);

    // parse tags if present
    let tags = question.tags || [];
    if (typeof payload.tags !== "undefined") {
      try {
        tags = typeof payload.tags === "string" ? JSON.parse(payload.tags) : payload.tags;
      } catch (e) {
        tags = payload.tags || [];
      }
    }

    question.title = payload.title || question.title;
    question.description = typeof payload.description !== "undefined" ? payload.description : question.description;
    question.type = payload.type || question.type;
    question.options = finalOptions;
    question.required = typeof payload.required !== "undefined" ? (payload.required === "true" || payload.required === true) : question.required;
    question.section = typeof payload.section !== "undefined" ? payload.section : question.section;
    question.order = typeof payload.order !== "undefined" ? Number(payload.order) : question.order;
    question.meta = payload.meta ? (typeof payload.meta === "string" ? JSON.parse(payload.meta) : payload.meta) : question.meta;
    question.active = typeof payload.active !== "undefined" ? (payload.active === "true" || payload.active === true) : question.active;
    question.tags = tags;

    await question.save();
    return response(res, true, "Question updated successfully", question);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- DELETE QUESTION --------------------
exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);
    if (!question) return response(res, false, "Question not found");

    await question.deleteOne();
    return response(res, true, "Question deleted successfully");
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- RESPONSES & other handlers remain unchanged (omitted for brevity) --------------------

exports.listResponses = async (req, res) => {
  try {
    const { userId, page = 1, limit = 50, search } = req.query;
    const q = {};
    if (userId) {
      if (mongoose.Types.ObjectId.isValid(userId)) q.userId = mongoose.Types.ObjectId(userId);
      else q["metadata.userIdentifier"] = { $regex: userId, $options: "i" };
    }
    if (search) {
      q.$or = [
        { "metadata.ip": { $regex: search, $options: "i" } },
        { "metadata.device": { $regex: search, $options: "i" } },
        { "answers.text": { $regex: search, $options: "i" } },
        { "answers.values": { $elemMatch: { $regex: search, $options: "i" } } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const responses = await Response.find(q).sort({ createdAt: -1 }).populate('userId').skip(skip).limit(Number(limit));
    const total = await Response.countDocuments(q);

    return response(res, true, "Responses fetched", { items: responses, total });
  } catch (error) {
    return response(res, false, error.message);
  }
};

exports.getResponseById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return response(res, false, "Response id required");
    const resp = await Response.findById(id);
    if (!resp) return response(res, false, "Response not found");
    return response(res, true, "Response fetched", resp);
  } catch (error) {
    return response(res, false, error.message);
  }
};

exports.responsesByUser = async (req, res) => {
  try {
    const { userId, page = 1, limit = 50 } = req.query;
    if (!userId) return response(res, false, "userId query required");

    const query = {};
    if (mongoose.Types.ObjectId.isValid(userId)) query.userId = mongoose.Types.ObjectId(userId);
    else query["metadata.userIdentifier"] = { $regex: userId, $options: "i" };

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const items = await Response.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Response.countDocuments(query);

    return response(res, true, "User responses fetched", { items, total });
  } catch (error) {
    return response(res, false, error.message);
  }
};

exports.myResponses = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return response(res, false, "Unauthorized", null, 401);

    const { page = 1, limit = 50 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const items = await Response.find({ userId: user._id }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Response.countDocuments({ userId: user._id });

    return response(res, true, "My responses fetched", { items, total });
  } catch (error) {
    return response(res, false, error.message);
  }
};

exports.deleteResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const resp = await Response.findById(id);
    if (!resp) return response(res, false, "Response not found");
    await resp.deleteOne();
    return response(res, true, "Response deleted successfully");
  } catch (error) {
    return response(res, false, error.message);
  }
};