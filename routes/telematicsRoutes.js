// routes/telematicsRoutes.js
const express = require("express");
const {
  getTelematicsData,
  updateMileageFromTelematics,
  handleTelematicsEvent,
} = require("../controllers/telematicsController");

const router = express.Router();

// 🛰️ Telematics Routes
router.get("/:id", getTelematicsData); // Get live telematics data
router.patch("/:id/mileage", updateMileageFromTelematics); // Sync Mileage from Telematics

// 🚨 Event Listener from Event Bus
router.post("/events", handleTelematicsEvent); // Handle mileage.updated events

// Export Routes
module.exports = router;
