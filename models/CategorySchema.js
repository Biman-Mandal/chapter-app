const mongoose = require("mongoose");
const { softDeletePlugin } = require("../middleware/softDelete");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "categories",
      default: null, // null means it's a parent category
    },
    description: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: null,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ✅ Soft delete plugin
categorySchema.plugin(softDeletePlugin);

// ✅ Pre-save slug generator
categorySchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name.toLowerCase().replace(/ /g, "-");
  }
  next();
});

const Category = mongoose.model("categories", categorySchema);
module.exports = Category;
