const mongoose = require('mongoose');

const softDeletePlugin = (schema) => {
  // Add soft delete fields to schema
  schema.add({
    isDeleted: {
      type: Boolean,
      required: true,
      default: false,
    },
    deletedAt: {
      type: Date, // Or Date
      default: null,
    },
  });

  const typesFindQueryMiddleware = [
    'count',
    'find',
    'findOne',
    'findById',
    'findOneAndDelete',
    'findByIdAndDelete',
    'findOneAndRemove',
    'findByIdAndRemove',
    'findOneAndUpdate',
    'findByIdAndUpdate',
    'update',
    'updateOne',
    'updateMany',
    'countDocuments',
  ];

  // Only set deletedAt — that's what indicates a deletion
  const setDocumentIsDeleted = async (doc) => {
    doc.isDeleted = true;
    doc.deletedAt = Date.now();
    doc.$isDeleted?.(true); // Optional custom state tracker
    await doc.save();
  };

  // Main change: filter by deletedAt: null
  const excludeInFindQueriesIsDeleted = async function (next) {
    this.where({ deletedAt: null });
    next();
  };

  const excludeInDeletedInAggregateMiddleware = async function (next) {
    this.pipeline().unshift({ $match: { deletedAt: null } });
    next();
  };

  schema.pre('deleteOne', { document: true }, function (next) {
    setDocumentIsDeleted(this);
    next();
  });

  typesFindQueryMiddleware.forEach((type) => {
    schema.pre(type, excludeInFindQueriesIsDeleted);
  });

  schema.pre('aggregate', excludeInDeletedInAggregateMiddleware);
};

module.exports = {
  softDeletePlugin,
};
