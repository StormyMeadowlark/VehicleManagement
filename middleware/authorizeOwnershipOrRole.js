const Vehicle = require("../models/vehicleModel");

function authorizeOwnershipOrRole({
  model,
  idParam = "id",
  allowedRoles = [],
}) {
  return async (req, res, next) => {
    const userId = req.user?.id;
    const userRole = req.user?.userRole || req.user?.role;

    if (allowedRoles.includes(userRole)) {
      return next(); // ✅ Elevated role allowed
    }

    try {
      const resourceId = req.params[idParam];
      const resource = await model.findById(resourceId).select("userId");

      if (!resource) {
        return res.status(404).json({ message: "Resource not found." });
      }

      if (resource.userId.toString() === userId) {
        return next(); // ✅ User owns the resource
      }

      return res
        .status(403)
        .json({ message: "Forbidden: Not owner or allowed role." });
    } catch (err) {
      console.error("❌ Ownership check failed:", err.message);
      return res.status(500).json({ message: "Ownership check error." });
    }
  };
}

module.exports = authorizeOwnershipOrRole;
