// utils/checkTenantScopeAccess.js

const mongoose = require("mongoose");
const { getTenantFilterByRole } = require("./tenantFilterHelper");
const logger = require("./logger");

/**
 * Reusable helper to determine if a user has access to a specific tenant.
 * Returns a scoped filter OR throws an error.
 */
const checkTenantScopeAccess = ({
  requestedTenantId,
  tenantId,
  tenantType,
  userRole,
  userId,
  origin = "Unknown",
  allowSelf = true,
}) => {
  if (!mongoose.Types.ObjectId.isValid(requestedTenantId)) {
    const message = "Invalid tenant ID format.";
    logger.warn(message, { requestedTenantId, userId, origin });
    throw { status: 400, message };
  }

  const isSelfTenant = tenantId === requestedTenantId;

  if (allowSelf && isSelfTenant) {
    return { _id: requestedTenantId };
  }

  const roleFilter = getTenantFilterByRole(tenantType, userRole, tenantId);

  if (!roleFilter || Object.keys(roleFilter).length === 0) {
    const message = "You do not have permission to access this tenant.";
    logger.warn(message, {
      tenantId,
      requestedTenantId,
      tenantType,
      userRole,
      userId,
      origin,
    });
    throw { status: 403, message };
  }

  return { _id: requestedTenantId, ...roleFilter };
};

module.exports = checkTenantScopeAccess;
