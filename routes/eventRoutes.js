// routes/eventRoutes.js
const express = require("express");
const {
  handleMileageUpdatedEvent,
  handleServiceCompletedEvent,
} = require("../controllers/eventController");

const router = express.Router();

// 🟠 Event Listeners
router.post("/mileage-updated", handleMileageUpdatedEvent); // Event: Mileage Updated
router.post("/service-completed", handleServiceCompletedEvent); // Event: Service Completed

// Export Routes
module.exports = router;
