const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  console.log("🔐 Protect middleware hit!");

  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("🚫 No Authorization header found.");
      return res
        .status(401)
        .json({ message: "No token provided, authorization denied." });
    }

    const token = authHeader.split(" ")[1];
    console.log("🛠 Extracted token:", token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔑 Decoded Token:", decoded);

    req.user = {
      id: decoded.id || "Unknown",
      email: decoded.email || "Unknown",
      userRole: decoded.userRole || "Unauthenticated",
      tenantId: decoded.tenantId || "Unknown",
      tenantType: decoded.tenantType || "Unknown",
      tier: decoded.tier|| "Basic"
    };

    console.log("✅ User attached to request:", req.user);
    next(); // Continue
  } catch (error) {
    console.log("❌ JWT Verification Failed:", error.message);
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};
module.exports = { protect };
