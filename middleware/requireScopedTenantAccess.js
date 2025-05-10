const { getTenantScopedFilter } = require("../utils/tenantFilterHelper");
const logger = require("../utils/logger");

/**
 * Middleware to attach scoped tenant filter to the request.
 * Can be reused across GET, PUT, PATCH, DELETE routes.
 *
 * @param {Object} baseFilter - Optional MongoDB filter (e.g., { deleted: false })
 * @returns Express middleware
 */
module.exports = function requireScopedTenantAccess(baseFilter = {}) {
  return (req, res, next) => {
    const { id: userId, tenantType, userRole, tenantId } = req.user || {};

    const origin = req.ip;

    const scopedFilter = getTenantScopedFilter({
      tenantType,
      userRole,
      tenantId,
      userId,
      origin,
      baseFilter,
    });

    if (!scopedFilter) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have access to these tenants.",
      });
    }

    req.scopedTenantFilter = scopedFilter;
    next();
  };
};
