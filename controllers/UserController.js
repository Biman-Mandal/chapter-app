const User = require("../models/UserSchema");
const Response = require("../models/ResponseSchema");
const { response } = require("../utils/response");

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

// -------------------- GET MY RESPONSES (AUTHENTICATED USER) --------------------
exports.myResponses = async (req, res) => {
  try {
    const userId = req.user.userId;

    const { page = 1, limit = 50 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const items = await Response.find({ userId: userId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Response.countDocuments({ userId: userId });

    return response(res, true, "My responses fetched", { items, total });
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- SUBMIT RESPONSE --------------------
exports.submitResponse = async (req, res) => {
  try {
    const userId = req.user.userId;
    const payload = req.body;
    // payload.answers should be array of { questionId, values[], text? }
    if (!Array.isArray(payload.answers) || payload.answers.length === 0) {
      return response(res, false, "Answers are required");
    }

    const resp = await Response.create({
      userId: userId,
      answers: payload.answers,
      metadata: payload.metadata || {},
    });

    return response(res, true, "Response saved", resp);
  } catch (error) {
    return response(res, false, error.message);
  }
};
