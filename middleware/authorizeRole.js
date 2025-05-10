module.exports = function authorizeRole(
  allowedTenantTypes = [],
  allowedUserRoles = []
) {
  return (req, res, next) => {
    const { tenantType, userRole } = req.user;

    const tenantAllowed =
      allowedTenantTypes.length === 0 ||
      allowedTenantTypes.includes(tenantType);
    const userAllowed =
      allowedUserRoles.length === 0 || allowedUserRoles.includes(userRole);

    if (!tenantAllowed || !userAllowed) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Insufficient role permissions",
      });
    }

    next();
  };
};
