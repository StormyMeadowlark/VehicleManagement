const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Normalize the decoded token payload
    req.user = {
      id: decoded.id || "Unknown",
      email: decoded.email || "Unknown",
      userRole: decoded.userRole || "Unauthenticated",
      tenantId: decoded.tenantId || "Unknown",
      tenantType: decoded.tenantType || "Unknown",
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

module.exports = authenticate;
