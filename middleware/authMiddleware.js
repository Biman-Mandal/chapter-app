const jwt = require('jsonwebtoken');
const UserMaster = require('../models/UserSchema');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from the Authorization header
    const authHeader = req.header('Authorization');
    console.log(authHeader, 'authHeader-----------')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        status: 2,
        message: 'Access denied. No token provided or invalid token format.'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        status: 2,
        message: 'Access denied. Token is required.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by id
    const user = await UserMaster.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        status: 2,
        message: 'Invalid token. User not found.'
      });
    }
    if(!user.status){
        return res.status(401).json({
            success: false,
            message: "Your account has been deactivated. Please contact our support team.",
        });
    }
    // Add user data to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      username: user?.username,
    };
    req.userData = user
    next();
  } catch (error) {
    console.log(error)
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        status: 3,
        message: 'Invalid token.'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = authMiddleware; 