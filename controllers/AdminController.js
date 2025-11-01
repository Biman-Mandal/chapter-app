const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const User = require("../models/UserSchema")

// Helper: Format user data
const formatUser = (user = {}) => ({
  id: user._id?.toString() || "",
  fullName: user.fullName || "",
  email: user.email || "",
  phone: user.phone || "",
  profilePic: user.profilePic || "",
  jwtToken: user.jwtToken || "",
  is_admin: user.is_admin ? 1 : 0,
  status: user.status ? 1 : 0,
  createdAt: user.createdAt || "",
  updatedAt: user.updatedAt || "",
})

// Helper: Uniform response
const response = (res, status, message, data = {}) => {
  return res.status(status ? 200 : 400).json({
    status,
    message: message || "",
    data,
  })
}

// Admin Login
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) return response(res, false, "Admin not found")

    // Check if user is admin
    if (!user.is_admin) {
      return response(res, false, "Access denied. User is not an admin")
    }

    // Check if account is active
    if (!user.status) {
      return response(res, false, "Your admin account has been deactivated")
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) return response(res, false, "Invalid credentials")

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        isAdmin: user.is_admin,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    )

    user.jwtToken = token
    await user.save()

    return response(res, true, "Admin login successful", formatUser(user))
  } catch (error) {
    return response(res, false, error.message)
  }
}

// Create Admin (only by super admin)
exports.createAdmin = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body

    // Check if user making request is admin
    if (!req.user || !req.userData?.is_admin) {
      return response(res, false, "Only admins can create new admins")
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] })
    if (existingUser) {
      return response(res, false, "Email or phone already registered")
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const newAdmin = await User.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      is_admin: true,
      status: true,
    })

    return response(res, true, "Admin created successfully", formatUser(newAdmin))
  } catch (error) {
    return response(res, false, error.message)
  }
}

// Get Admin Profile
exports.getAdminProfile = async (req, res) => {
  try {
    if (!req.userData?.is_admin) {
      return response(res, false, "Access denied. Admin only")
    }

    return response(res, true, "Admin profile retrieved", formatUser(req.userData))
  } catch (error) {
    return response(res, false, error.message)
  }
}

// Get All Users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    if (!req.userData?.is_admin) {
      return response(res, false, "Access denied. Admin only")
    }

    const users = await User.find({ is_admin: false }).select("-password")
    return response(res, true, "Users retrieved successfully", { users })
  } catch (error) {
    return response(res, false, error.message)
  }
}

// Deactivate User (Admin only)
exports.deactivateUser = async (req, res) => {
  try {
    if (!req.userData?.is_admin) {
      return response(res, false, "Access denied. Admin only")
    }

    const { userId } = req.body
    const user = await User.findByIdAndUpdate(userId, { status: false }, { new: true })

    if (!user) return response(res, false, "User not found")

    return response(res, true, "User deactivated successfully", formatUser(user))
  } catch (error) {
    return response(res, false, error.message)
  }
}
