const User = require("../../models/UserSchema");
const { response } = require("../../utils/response");

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

// -------------------- USER LIST (Registered Users Only) --------------------
exports.userList = async (req, res) => {
  try {
    const { search, status } = req.query;

    const query = {
      is_admin: false, // ✅ Exclude admins
    };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (typeof status != "undefined") {
      query.status = status
    }
    console.log(query, 'query')
    // ✅ Fetch only registered (non-admin) users, latest first
    const users = await User.find(query).sort({ createdAt: -1 });

    const formattedUsers = users.map((user) => formatUser(user));

    return response(res, true, "Registered user list fetched successfully", formattedUsers);
  } catch (error) {
    return response(res, false, error.message);
  }
};
