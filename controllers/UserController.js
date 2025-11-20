const User = require("../models/UserSchema");
const { response } = require("../utils/response");
const ResponseModel = require("../models/ResponseSchema");
const Question = require("../models/QuestionSchema");
const Tag = require("../models/TagSchema");
const mongoose = require("mongoose");
const crypto = require("crypto");

// 🔹 Helper: Format user data
const formatUser = (user = {}) => ({
  id: user._id?.toString() || "",
  fullName: user.fullName || "",
  email: user.email || "",
  phone: user.phone || "",
  profilePic: user.profilePic || "",
  jwtToken: user.jwtToken || "",
  firebaseToken: user.firebaseToken || "",
  is_admin: user.is_admin ? 1 : 0,
  status: user.status ? 1 : 0,
  createdAt: user.createdAt || "",
  updatedAt: user.updatedAt || "",
  lastLogin: user.lastLogin || null,
});

// -------------------- GET PROFILE --------------------
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return response(res, false, "User not found");

    return response(res, true, "Profile fetched successfully", formatUser(user));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- existing admin functions (userList, userDetails, setUserStatus) are preserved below --------------------
exports.userList = async (req, res) => {
  try {
    const { search, status } = req.query;

    const query = {
      is_admin: false, // ✅ Exclude admins
    };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (typeof status !== "undefined") {
      // Allow filtering by status (0 or 1)
      query.status = Number(status) === 1;
    }

    const users = await User.find(query).sort({ createdAt: -1 });

    const formattedUsers = users.map((user) => formatUser(user));

    return response(res, true, "Registered user list fetched successfully", formattedUsers);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- UPDATE PROFILE --------------------
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone, profilePic } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { fullName, phone, profilePic },
      { new: true }
    );

    return response(res, true, "Profile updated successfully", formatUser(updatedUser));
  } catch (error) {
    return response(res, false, error.message);
  }
};

exports.userDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user || user.is_admin) {
      return response(res, false, "User not found", null, 404);
    }

    return response(res, true, "User details fetched successfully", formatUser(user));
  } catch (error) {
    return response(res, false, error.message);
  }
};

exports.setUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { status } = req.body;

    const user = await User.findById(id);

    if (!user || user.is_admin) {
      return response(res, false, "User not found", null, 404);
    }

    // If status not provided, toggle
    if (typeof status === "undefined" || status === null) {
      status = user.status ? 0 : 1;
    }

    // accept numeric 0/1 or boolean
    const newStatus = Number(status) === 1;
    user.status = newStatus;
    await user.save();

    return response(res, true, "User status updated", formatUser(user));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- PUBLIC: submitResponse (guest or authenticated) --------------------
exports.submitResponse = async (req, res) => {
  try {
    const payload = req.body || {};
    const answers = Array.isArray(payload.answers) ? payload.answers : [];
    const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

    if (!answers || answers.length === 0) {
      return response(res, false, "Answers are required");
    }

    const isAuth = !!req.user && !!req.user.userId;

    // determine userIdentifier (guest flow)
    let guestIdentifier = metadata.userIdentifier || null;
    if (!isAuth && !guestIdentifier) {
      guestIdentifier = crypto.randomBytes(12).toString("hex"); // return this so frontend can remember
      metadata.userIdentifier = guestIdentifier;
    }

    // collect questionIds to resolve tags
    const qIds = [];
    for (const a of answers) {
      if (a.questionId) qIds.push(a.questionId);
    }

    let tagIds = [];
    if (qIds.length > 0) {
      // fetch questions
      const questions = await Question.find({ _id: { $in: qIds } }).lean();
      const qMap = new Map();
      for (const q of questions) qMap.set(String(q._id), q);

      // gather tag names
      const tagNameSet = new Set();
      for (const a of answers) {
        const q = qMap.get(String(a.questionId));
        if (!q || !Array.isArray(q.options)) continue;
        const values = Array.isArray(a.values) ? a.values : (a.values ? [a.values] : []);
        for (const val of values) {
          // find matching option
          const opt = q.options.find(
            (o) => String(o.id) === String(val) || String(o.value) === String(val) || String(o.text) === String(val)
          );
          if (opt && Array.isArray(opt.tags)) {
            for (const t of opt.tags) {
              if (t && String(t).trim() !== "") tagNameSet.add(String(t).trim());
            }
          }
        }
      }

      // convert tag names to Tag docs (create if missing)
      if (tagNameSet.size > 0) {
        const tagNames = Array.from(tagNameSet);
        const existing = await Tag.find({ name: { $in: tagNames } }).lean();
        const existingMap = new Map();
        for (const t of existing) existingMap.set(t.name, t);

        const createdTagIds = [];
        for (const name of tagNames) {
          if (existingMap.has(name)) {
            createdTagIds.push(existingMap.get(name)._id);
          } else {
            const newTag = await Tag.create({ name: name.trim() });
            createdTagIds.push(newTag._id);
          }
        }
        tagIds = createdTagIds;
      }
    }

    // prepare response doc
    const respDoc = {
      answers,
      metadata: {
        ...metadata,
        tagIds, // store tag ObjectIds on response for quick lookup later
      },
    };

    if (isAuth) {
      respDoc.userId = req.user.userId;
    }

    const created = await ResponseModel.create(respDoc);

    // if authenticated, merge tagIds into user.chosenTags (keep unique)
    if (isAuth && tagIds.length > 0) {
      const user = await User.findById(req.user.userId);
      if (user) {
        const existing = Array.isArray(user.chosenTags) ? user.chosenTags.map(String) : [];
        const toAdd = tagIds.map((t) => String(t)).filter((id) => !existing.includes(id));
        if (toAdd.length > 0) {
          user.chosenTags = [...existing.map((id) => mongoose.Types.ObjectId(id)), ...toAdd.map((id) => mongoose.Types.ObjectId(id))];
          await user.save();
        }
      }
    }

    return response(res, true, "Response submitted", {
      responseId: created._id,
      guestIdentifier: !isAuth ? guestIdentifier : null,
      tagIds,
    });
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- AUTHED: myResponses (paginated) --------------------
exports.myResponses = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return response(res, false, "Unauthorized");

    const { page = 1, limit = 50 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const items = await ResponseModel.find({ userId: user.userId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await ResponseModel.countDocuments({ userId: user.userId });

    return response(res, true, "My responses fetched", { items, total });
  } catch (error) {
    return response(res, false, error.message);
  }
};