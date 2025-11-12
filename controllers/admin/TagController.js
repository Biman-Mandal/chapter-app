const Tag = require("../../models/TagSchema");
const { response } = require("../../utils/response");

// list tags
exports.listTags = async (req, res) => {
  try {
    const tags = await Tag.find().sort({ createdAt: -1 });
    return response(res, true, "Tags fetched", tags);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// create tag
exports.createTag = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return response(res, false, "Tag name is required");
    const existing = await Tag.findOne({ name: name.trim() });
    if (existing) return response(res, false, "Tag already exists");
    const tag = await Tag.create({ name: name.trim() });
    return response(res, true, "Tag created", tag);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// update tag
exports.updateTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const tag = await Tag.findById(id);
    if (!tag) return response(res, false, "Tag not found");
    tag.name = name || tag.name;
    await tag.save();
    return response(res, true, "Tag updated", tag);
  } catch (error) {
    return response(res, false, error.message);
  }
};

// delete tag
exports.deleteTag = async (req, res) => {
  try {
    const { id } = req.params;
    const tag = await Tag.findById(id);
    if (!tag) return response(res, false, "Tag not found");
    await tag.deleteOne();
    return response(res, true, "Tag deleted");
  } catch (error) {
    return response(res, false, error.message);
  }
};