require("dotenv").config();
require("./config/db");

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require('cors');

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const authRouter = require("./routes/auth");
const adminRouter = require("./routes/admin/admin")
const adminUserRouter = require("./routes/admin/user")
const adminCategoryRouter = require("./routes/admin/categoryRoutes")
const adminQuestionRouter = require("./routes/admin/questionRoutes")
const subscriptionRouter = require("./routes/admin/subscriptions")
const tagRoutes = require("./routes/admin/tagRoutes")
const bookRoutes = require("./routes/admin/bookRoutes")
const chapterRoutes = require("./routes/admin/chapterRoutes")
const reelRoutes = require("./routes/admin/reelRoutes")
const planRoutes = require("./routes/admin/planRoutes")
const paymentRoutes = require("./routes/admin/paymentRoutes")
const questionRoutes = require("./routes/question")
const bookFrontRoutes = require("./routes/book")
const categoryRoutes = require("./routes/category")
const app = express();
app.use(cors());

// -------------------- View Engine --------------------
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// -------------------- Middleware --------------------
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// -------------------- Route Hit Logger --------------------
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// -------------------- Routes --------------------
app.use("/", indexRouter);
app.use("/api/users", usersRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter)
app.use("/api/admin", adminUserRouter)
app.use("/api/admin/categories", adminCategoryRouter)
app.use("/api/admin/questions", adminQuestionRouter)
app.use("/api/admin/subscriptions", subscriptionRouter)
app.use("/api/admin/tags", tagRoutes)
app.use("/api/admin/books", bookRoutes)
app.use("/api/admin/chapters", chapterRoutes)
app.use("/api/admin/reels", reelRoutes)
app.use("/api/admin/plans", planRoutes)
app.use("/api/admin/payments", paymentRoutes)
app.use("/api/questions", questionRoutes)
app.use("/api/books", bookFrontRoutes)
app.use("/api/category", categoryRoutes)
// -------------------- 404 Handler -------------------- 
app.use((req, res, next) => {
  console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    status: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// -------------------- Global Error Handler --------------------
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err.message);

  // Return consistent JSON response
  res.status(err.status || 500).json({
    status: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
