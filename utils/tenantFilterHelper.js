// utils/tenantFilterHelper.js
const logger = require("./logger");
/**
 * Returns a MongoDB filter based on user role and tenantId
 * for use in tenant-scoped queries (e.g., getActiveTenants, searchTenants)
 */
const getTenantFilterByRole = (tenantType, userRole, tenantId) => {
  // ✅ Allow full access if tenantAdmin under a Platform Admin tenant
  if (userRole === "tenantAdmin" && tenantType === "Platform Admin") {
    return {}; // No restriction
  }

  switch (tenantType) {
    case "Platform Admin":
      return {}; // fallback if role isn't tenantAdmin but tenantType is

    case "Agency":
    case "Reseller":
      return { parentTenantId: tenantId };

    case "Vendor":
    case "Partner":
      return { connectedVendorIds: { $in: [tenantId] } };

    default:
      return null; // Not authorized
  }
};

const getTenantScopedFilter = ({
  tenantType,
  userRole,
  tenantId,
  userId = "Unknown",
  origin = "Unknown",
  baseFilter = {},
}) => {
  const scopeFilter = getTenantFilterByRole(tenantType, userRole, tenantId);

  if (scopeFilter === null) {
    logger.warn("Access denied — no tenant scope for this role", {
      userId,
      tenantType,
      userRole,
      tenantId,
      origin,
    });
    return null;
  }

  const fullFilter = { ...scopeFilter, ...baseFilter };

  logger.info("Tenant scope filter generated", {
    userId,
    tenantType,
    userRole,
    tenantId,
    origin,
    appliedFilter: fullFilter,
  });

  return fullFilter;
};

module.exports = { getTenantFilterByRole, getTenantScopedFilter };
