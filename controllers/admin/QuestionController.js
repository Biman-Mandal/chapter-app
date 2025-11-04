const Question = require("../../models/QuestionSchema");
const Response = require("../../models/ResponseSchema");
const { response } = require("../../utils/response");

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
    const payload = req.body;
    // minimal validation
    if (!payload.title || !payload.type) {
      return response(res, false, "title and type are required");
    }

    const q = await Question.create({
      title: payload.title,
      type: payload.type,
      options: payload.options || [],
      required: !!payload.required,
      section: payload.section || "",
      order: payload.order || 0,
      meta: payload.meta || {},
      createdBy: req.user ? req.user._id : undefined,
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
    const payload = req.body;

    const question = await Question.findById(id);
    if (!question) return response(res, false, "Question not found");

    question.title = payload.title || question.title;
    question.type = payload.type || question.type;
    question.options = typeof payload.options !== "undefined" ? payload.options : question.options;
    question.required = typeof payload.required !== "undefined" ? payload.required : question.required;
    question.section = payload.section || question.section;
    question.order = typeof payload.order !== "undefined" ? payload.order : question.order;
    question.meta = payload.meta || question.meta;
    question.active = typeof payload.active !== "undefined" ? payload.active : question.active;

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

// -------------------- SUBMIT RESPONSE --------------------
exports.submitResponse = async (req, res) => {
  try {
    const payload = req.body;
    // payload.answers should be array of { questionId, values[], text? }
    if (!Array.isArray(payload.answers) || payload.answers.length === 0) {
      return response(res, false, "Answers are required");
    }

    const resp = await Response.create({
      userId: req.user ? req.user._id : payload.userId || null,
      answers: payload.answers,
      metadata: payload.metadata || {},
    });

    return response(res, true, "Response saved", resp);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- LIST RESPONSES (ADMIN) --------------------
exports.listResponses = async (req, res) => {
  try {
    const { userId } = req.query;
    const q = {};
    if (userId) q.userId = userId;

    const responses = await Response.find(q).sort({ createdAt: -1 }).limit(100);
    return response(res, true, "Responses fetched", responses);
  } catch (error) {
    return response(res, false, error.message);
  }
};

