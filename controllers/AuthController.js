const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/UserSchema");
const { sendEmail } = require("../utils/sendEmail");

// Temporary OTP store (use Redis or DB in production)
let otpStore = {};

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

// -------------------- REGISTER --------------------
exports.register = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser)
      return response(res, false, "Email or phone already registered");

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
    });

    return response(res, true, "User registered successfully", formatUser(newUser));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- LOGIN --------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return response(res, false, "User not found");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return response(res, false, "Invalid credentials");
    const token = jwt.sign({
      userId: user._id,
      email: user.email,
    }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    user.jwtToken = token;
    await user.save();

    return response(res, true, "Login successful", formatUser(user));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- FORGOT PASSWORD (Send OTP) --------------------
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return response(res, false, "Email is required");

    const user = await User.findOne({ email });
    if (!user) return response(res, false, "User not found");

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore[email] = otp;

    await sendEmail(
      email,
      "Password Reset OTP",
      `Your OTP for password reset is: ${otp}`
    );

    return response(res, true, "OTP sent to email", { email });
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- VERIFY OTP & RESET PASSWORD --------------------
exports.verifyOtpAndReset = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
      return response(res, false, "Email, OTP, and new password are required");

    if (otpStore[email] !== parseInt(otp))
      return response(res, false, "Invalid or expired OTP");

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    delete otpStore[email];
    return response(res, true, "Password reset successful");
  } catch (error) {
    return response(res, false, error.message);
  }
};
