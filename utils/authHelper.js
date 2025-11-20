const jwt = require("jsonwebtoken");

/**
 * Decode Bearer token from request and return { userId } or null.
 * Does NOT throw; returns null on invalid/absent token.
 */
function getUserFromAuthHeader(req) {
  try {
    const auth = req.header("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) return null;
    const token = auth.split(" ")[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && decoded.userId) return { userId: decoded.userId, decoded };
    return null;
  } catch (err) {
    return null;
  }
}

module.exports = { getUserFromAuthHeader };