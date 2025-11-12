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
  lastLogin: user.lastLogin || null,
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

    if (typeof status !== "undefined") {
      // Allow filtering by status (0 or 1)
      query.status = Number(status) === 1;
    }

    const users = await User.find(query).sort({ createdAt: -1 });

    const formattedUsers = users.map((user) => formatUser(user));

    return response(res, true, "Registered user list fetched successfully", formattedUsers);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- USER DETAILS --------------------
exports.userDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user || user.is_admin) {
      return response(res, false, "User not found", null, 404);
    }

    return response(res, true, "User details fetched successfully", formatUser(user));
  } catch (error) {
    return response(res, false, error.message);
  }
};

// -------------------- TOGGLE / SET USER STATUS --------------------
exports.setUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { status } = req.body;

    const user = await User.findById(id);

    if (!user || user.is_admin) {
      return response(res, false, "User not found", null, 404);
    }

    // If status not provided, toggle
    if (typeof status === "undefined" || status === null) {
      status = user.status ? 0 : 1;
    }

    // accept numeric 0/1 or boolean
    const newStatus = Number(status) === 1;
    user.status = newStatus;
    await user.save();

    return response(res, true, "User status updated", formatUser(user));
  } catch (error) {
    return response(res, false, error.message);
  }
};