const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/UserSchema");
const ResponseSchema = require("../models/ResponseSchema");
const Question = require("../models/QuestionSchema");
const Tag = require("../models/TagSchema");
const { sendEmail } = require("../utils/sendEmail");
const mongoose = require("mongoose");

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
  is_verified: user.is_verified ? 1 : 0,
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

/**
 * Helper: Given an array of response documents, extract tag names by looking up question options.
 * Returns array of Tag ObjectIds (creates tags if they don't exist).
 */
const extractTagIdsFromResponses = async (responses = []) => {
  const tagNameSet = new Set();

  // Gather all questionIds that are present in answers
  const qIds = new Set();
  for (const r of responses) {
    if (!r.answers) continue;
    for (const a of r.answers) {
      if (a.questionId) qIds.add(String(a.questionId));
    }
  }

  if (qIds.size === 0) return [];

  const questions = await Question.find({ _id: { $in: Array.from(qIds) } }).lean();

  // map questions
  const qMap = new Map();
  for (const q of questions) {
    qMap.set(String(q._id), q);
  }

  // For each response -> answers -> values, find matching option and collect option.tags (strings)
  for (const r of responses) {
    if (!r.answers) continue;
    for (const a of r.answers) {
      if (!a.values || !Array.isArray(a.values)) continue;
      const q = qMap.get(String(a.questionId));
      if (!q || !Array.isArray(q.options)) continue;

      for (const val of a.values) {
        // match by option.id, option.value or option.text
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
  }

  // Convert tag names to Tag documents (create if missing) and return their ObjectIds
  const tagNames = Array.from(tagNameSet);
  if (tagNames.length === 0) return [];

  const existingTags = await Tag.find({ name: { $in: tagNames } }).lean();
  const existingMap = new Map();
  for (const t of existingTags) existingMap.set(t.name, t);

  const tagIds = [];
  for (const name of tagNames) {
    if (existingMap.has(name)) {
      tagIds.push(existingMap.get(name)._id);
    } else {
      // create new tag
      const newTag = await Tag.create({ name: name.trim() });
      tagIds.push(newTag._id);
    }
  }

  return tagIds;
};

// -------------------- REGISTER (with optional guestIdentifier merge) --------------------
exports.register = async (req, res) => {
  try {
    const { fullName, email, phone, password, guestIdentifier } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser)
      return response(res, false, "Email or phone already registered");

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      // is_verified defaults to false via schema
    });

    // create email verification token (hex)
    const token = crypto.randomBytes(20).toString("hex");
    newUser.verificationToken = token;
    // expires in 24 hours
    newUser.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    await newUser.save();

    // If guestIdentifier provided, merge guest responses into this user
    if (guestIdentifier) {
      // find responses where metadata.userIdentifier matches and userId is absent/null
      const guestResponses = await ResponseSchema.find({
        "metadata.userIdentifier": guestIdentifier,
      });
      console.log(guestResponses, 'guestResponses------')
      if (guestResponses && guestResponses.length > 0) {
        // attach userId to each response
        await Promise.all(
          guestResponses.map((r) =>
            ResponseSchema.findByIdAndUpdate(r._id, { $set: { userId: newUser._id } })
          )
        );

        // extract tag ids from those responses and merge into user's chosenTags
        const tagIds = await extractTagIdsFromResponses(guestResponses);

        if (tagIds && tagIds.length > 0) {
          const existing = Array.isArray(newUser.chosenTags) ? newUser.chosenTags.map(String) : [];
          const toAdd = tagIds.map((t) => String(t)).filter((id) => !existing.includes(id));
          if (toAdd.length > 0) {
            newUser.chosenTags = [
              ...existing.map((id) => new mongoose.Types.ObjectId(id)),
              ...toAdd.map((id) => new mongoose.Types.ObjectId(id)),
            ];
            await newUser.save();
          }
        }
      }
    }

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const verifyLink = `${appUrl}/api/auth/verify-email?email=${encodeURIComponent(
      newUser.email
    )}&token=${token}`;

    // ------------- HTML EMAIL TEMPLATE -------------
    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Verify Your Email</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 40px; }
          .container { max-width: 600px; margin: auto; background: #fff; padding: 25px; border-radius: 8px; }
          h2 { color: #333; }
          .btn {
            display: inline-block;
            background: #4A6CF7;
            color: white;
            padding: 12px 18px;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
          }
          p { color: #555; font-size: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Hello ${newUser.fullName || "User"},</h2>
          <p>Welcome to our platform! Please verify your email address by clicking the button below:</p>

          <a href="${verifyLink}" class="btn">Verify Email</a>

          <p style="margin-top:20px">If the button doesn't work, copy and paste this link into your browser:</p>
          <p>${verifyLink}</p>

          <p>Your verification token:</p>
          <p><b>${token}</b></p>

          <p>This link expires in 24 hours.</p>

          <p>Thanks,<br>Team</p>
        </div>
      </body>
      </html>
    `;

    // Send email
    await sendEmail(
      newUser.email,
      "Verify your email",
      htmlEmail // send HTML template
    );

    return response(
      res,
      true,
      "User registered successfully. A verification email has been sent. Guest responses were merged.",
      formatUser(newUser)
    );
  } catch (error) {
    console.log(error)
    return response(res, false, error.message);
  }
};

// -------------------- LOGIN --------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return response(res, false, "User not found");

    // ensure email is verified
    if (!user.is_verified) {
      return response(
        res,
        false,
        "Email not verified. Please verify your email before logging in."
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return response(res, false, "Invalid credentials");
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );
    user.jwtToken = token;
    user.lastLogin = new Date();
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
    otpStore[email] = {
      otp,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    };

    await sendEmail(
      email,
      "Password Reset OTP",
      `Your OTP for password reset is: ${otp}. It will expire in 15 minutes.`
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

    const record = otpStore[email];
    if (!record) return response(res, false, "Invalid or expired OTP");

    // check expiration
    if (record.expiresAt < Date.now())
      return response(res, false, "OTP has expired");

    if (record.otp !== parseInt(otp))
      return response(res, false, "Invalid or expired OTP");

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    delete otpStore[email];
    return response(res, true, "Password reset successful");
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- VERIFY EMAIL (HTML Response Version) --------------------
exports.verifyEmail = async (req, res) => {
  try {
    const email = req.body.email || req.query.email;
    const token = req.body.token || req.query.token;

    // helper for returning HTML consistently
    const sendHTML = (message, success = false) => {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verification</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
            .container { background: #fff; padding: 30px; border-radius: 8px; max-width: 480px; margin: auto; text-align: center; }
            h2 { color: ${success ? "#28a745" : "#dc3545"}; }
            p { font-size: 16px; color: #333; }
            .success { color: #28a745; font-weight: bold; }
            .error { color: #dc3545; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${success ? "Success!" : "Oops!"}</h2>
            <p class="${success ? "success" : "error"}">${message}</p>
          </div>
        </body>
        </html>
      `);
    };

    if (!email || !token)
      return sendHTML("Email and token are required");

    const user = await User.findOne({ email });
    if (!user) return sendHTML("User not found");

    if (user.is_verified)
      return sendHTML("Email already verified", true);

    // Token checks
    if (
      !user.verificationToken ||
      user.verificationToken !== token ||
      !user.verificationTokenExpires ||
      user.verificationTokenExpires < Date.now()
    ) {
      return sendHTML("Invalid or expired verification token");
    }

    // Mark email verified
    user.is_verified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    return sendHTML("Email verified successfully 🎉", true);

  } catch (error) {
    return res.send(`
      <h2>Error</h2>
      <p>${error.message}</p>
    `);
  }
};


// -------------------- RESEND VERIFICATION EMAIL --------------------
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return response(res, false, "Email is required");

    const user = await User.findOne({ email });
    if (!user) return response(res, false, "User not found");

    if (user.is_verified)
      return response(res, true, "Email already verified");

    const token = crypto.randomBytes(20).toString("hex");
    user.verificationToken = token;
    user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h
    await user.save();

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const verifyLink = `${appUrl}/auth/verify-email?email=${encodeURIComponent(
      user.email
    )}&token=${token}`;

    await sendEmail(
      user.email,
      "Verify your email - Resend",
      `Hello ${user.fullName || ""},\n\nPlease verify your email by clicking the link below:\n\n${verifyLink}\n\nToken: ${token}\n\nThis link will expire in 24 hours.\n\nThanks.`
    );

    return response(res, true, "Verification email resent", { email: user.email });
  } catch (error) {
    return response(res, false, error.message);
  }
};