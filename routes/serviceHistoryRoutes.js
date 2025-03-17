// routes/serviceHistoryRoutes.js
const express = require("express");
const {
  getServiceHistory,
  getMaintenancePlan,
  updateServiceAlert,
} = require("../controllers/serviceHistoryController");

const router = express.Router();

// 🛡️ Service & Maintenance
router.get("/:id", getServiceHistory); // Get Vehicle Service History
router.get("/:id/maintenance-plan", getMaintenancePlan); // Get Maintenance Plan
router.patch("/:id/service-alert", updateServiceAlert); // Update Service Alert Flag

// Export Routes
module.exports = router;
