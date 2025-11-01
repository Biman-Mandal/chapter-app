const jwt = require("jsonwebtoken")
const UserMaster = require("../models/UserSchema")

const adminAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      })
    }

    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Check if user is admin
    if (!decoded.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      })
    }

    const user = await UserMaster.findById(decoded.userId)
    if (!user || !user.is_admin) {
      return res.status(403).json({
        success: false,
        message: "Admin access denied.",
      })
    }

    if (!user.status) {
      return res.status(401).json({
        success: false,
        message: "Admin account deactivated.",
      })
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    }
    req.userData = user
    next()
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.name === "TokenExpiredError" ? "Token expired." : "Invalid token.",
    })
  }
}

module.exports = adminAuthMiddleware
