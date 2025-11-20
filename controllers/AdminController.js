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
      // return response(res, false, "Only admins can create new admins")
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

// Update Admin Profile
exports.updateAdminProfile = async (req, res) => {
  try {
    if (!req.userData?.is_admin) {
      return response(res, false, "Access denied. Admin only")
    }

    const { fullName, phone, profilePic } = req.body
    const adminId = req.userData._id

    // Validate input
    if (fullName && fullName.trim().length === 0) {
      return response(res, false, "Full name cannot be empty")
    }

    if (phone) {
      const phoneRegex = /^\+?[0-9]{7,15}$/
      if (!phoneRegex.test(phone)) {
        return response(res, false, "Please provide a valid phone number")
      }
    }

    // Check if phone is already used by another admin
    if (phone && phone !== req.userData.phone) {
      const existingPhone = await User.findOne({ phone, _id: { $ne: adminId } })
      if (existingPhone) {
        return response(res, false, "Phone number already in use")
      }
    }

    // Update admin profile
    const updateData = {}
    if (fullName) updateData.fullName = fullName
    if (phone) updateData.phone = phone
    if (profilePic) updateData.profilePic = profilePic

    const updatedAdmin = await User.findByIdAndUpdate(adminId, updateData, { new: true })

    return response(res, true, "Admin profile updated successfully", formatUser(updatedAdmin))
  } catch (error) {
    return response(res, false, error.message)
  }
}

// Change Admin Password
exports.changeAdminPassword = async (req, res) => {
  try {
    if (!req.userData?.is_admin) {
      return response(res, false, "Access denied. Admin only")
    }

    const { currentPassword, newPassword, confirmPassword } = req.body
    const adminId = req.userData._id

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return response(res, false, "All password fields are required")
    }

    if (newPassword !== confirmPassword) {
      return response(res, false, "New password and confirm password do not match")
    }

    if (newPassword.length < 8) {
      return response(res, false, "New password must be at least 8 characters long")
    }

    // Verify current password
    const admin = await User.findById(adminId)
    const isMatch = await bcrypt.compare(currentPassword, admin.password)
    if (!isMatch) {
      return response(res, false, "Current password is incorrect")
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await User.findByIdAndUpdate(adminId, { password: hashedPassword })

    return response(res, true, "Password changed successfully")
  } catch (error) {
    return response(res, false, error.message)
  }
}

// Get Admin Dashboard Stats
exports.getAdminStats = async (req, res) => {
  try {
    if (!req.userData?.is_admin) {
      return response(res, false, "Access denied. Admin only")
    }

    const totalUsers = await User.countDocuments({ is_admin: false })
    const activeUsers = await User.countDocuments({ is_admin: false, status: true })
    const inactiveUsers = await User.countDocuments({ is_admin: false, status: false })
    const totalAdmins = await User.countDocuments({ is_admin: true })

    return response(res, true, "Admin stats retrieved", {
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalAdmins,
    })
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
