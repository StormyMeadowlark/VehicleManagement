module.exports = function checkRBAC({
  userRole,
  tenantType,
  allowedUserRoles = [],
  allowedTenantTypes = [],
}) {
  const tenantAllowed =
    allowedTenantTypes.length === 0 || allowedTenantTypes.includes(tenantType);
  const userAllowed =
    allowedUserRoles.length === 0 || allowedUserRoles.includes(userRole);

  return tenantAllowed && userAllowed;
};
