const User = require("../models/UserSchema");

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

// 🔹 Helper: Uniform response
const response = (res, status, message, data = {}) => {
  return res.status(status ? 200 : 400).json({
    status,
    message: message || "",
    data,
  });
};

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
