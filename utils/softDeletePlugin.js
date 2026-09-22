import mongoose from "mongoose";

// Adds isDeleted/deletedAt/deletedBy to a schema and transparently excludes
// soft-deleted documents from find/findOne/countDocuments/findOneAndUpdate
// queries. Callers that explicitly filter on `isDeleted` (e.g. trash listings
// using { isDeleted: true }) are left untouched so admin "restore" flows can
// still look the document up.
export default function softDeletePlugin(schema) {
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  });

  function excludeDeleted(next) {
    const query = this.getQuery();
    if (query.isDeleted === undefined) {
      this.where({ isDeleted: { $ne: true } });
    }
    next();
  }

  ["find", "findOne", "countDocuments", "findOneAndUpdate"].forEach((method) => {
    schema.pre(method, excludeDeleted);
  });

  schema.methods.softDelete = function (userId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId || null;
    return this.save();
  };

  schema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };
}
