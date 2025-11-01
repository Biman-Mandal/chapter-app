const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { softDeletePlugin } = require("../middleware/softDelete");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, "Please provide a valid phone number"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
    },
    profilePic: {
      type: String,
      default: null,
    },
    jwtToken: {
      type: String,
      default: null,
    },
    firebaseToken: {
      type: String,
      default: null,
    },
    is_admin: {
      type: Boolean,
      default: false,
    },
    // 🔹 0 = inactive, 1 = active
    status: {
      type: Boolean,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// 🔹 Apply soft delete plugin
userSchema.plugin(softDeletePlugin);
// 🔹 Model export
const User = mongoose.model("users", userSchema);
module.exports = User;
