const jwt = require("jsonwebtoken");
const Question = require("../models/QuestionSchema");
const Response = require("../models/ResponseSchema");
const { response } = require("../utils/response");
const mongoose = require("mongoose");

exports.list = async (req, res) => {
  try {
    const { section, search } = req.query;
    const active = true;

    const includeAnswered = true
    const q = {};
    if (active !== undefined) q.active = !!active;
    if (section) q.section = section;
    if (search) q.title = { $regex: search, $options: "i" };

    const questions = await Question.find(q).sort({ order: 1 }).lean()

    // Prepare answered map if requested and token present
    let answeredMap = new Map();

    if (includeAnswered) {
      const authHeader = req.header("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const userId = decoded.userId;

          if (userId) {
            // fetch recent responses for this user (limit to 500 to avoid huge loads)
            // We'll build a map of questionId -> first (latest) answer found
            const responses = await Response.find({ userId: mongoose.Types.ObjectId(userId) })
              .sort({ createdAt: -1 })
              .limit(500)
              .lean();

            for (const resp of responses) {
              if (!Array.isArray(resp.answers)) continue;
              for (const ans of resp.answers) {
                const qid = String(ans.questionId);
                if (!answeredMap.has(qid)) {
                  // store the answer object (values/text) as the user's latest known answer for this question
                  answeredMap.set(qid, {
                    values: Array.isArray(ans.values) ? ans.values : (ans.values ? [ans.values] : []),
                    text: ans.text || "",
                    respondedAt: resp.createdAt || resp.updatedAt || null,
                    responseId: resp._id,
                  });
                }
              }
            }
          }
        } catch (err) {
          // token invalid/expired -> ignore includeAnswered but do not fail the request
        }
      }
    }

    // map options to keep only required fields for frontend
    const items = questions.map((qDoc) => {
      const simplified = {
        id: qDoc._id,
        title: qDoc.title,
        description: qDoc.description || "",
        type: qDoc.type,
        required: !!qDoc.required,
        section: qDoc.section || "",
        order: qDoc.order || 0,
        meta: qDoc.meta || {},
        options: Array.isArray(qDoc.options)
          ? qDoc.options.map((o) => ({
              id: o.id || null,
              text: o.text || "",
              value: o.value || "",
              image: o.image || "",
              video: o.video || "",
              order: o.order || 0,
              meta: o.meta || {},
              tags: Array.isArray(o.tags) ? o.tags : [], // tag names
            }))
          : [],
      };

      if (includeAnswered) {
        const ans = answeredMap.get(String(qDoc._id)) || null;
        simplified.userAnswer = ans;
      }

      return simplified;
    });

    return response(res, true, "Questions fetched", items);
  } catch (error) {
    return response(res, false, error.message);
  }
};