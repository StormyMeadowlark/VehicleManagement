const express = require("express");
const Vehicle = require("../models/vehicleModel")
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const authorizeOwnershipOrRole = require("../middleware/authorizeOwnershipOrRole");
const {
  createVehicle,
  getAllVehicles,
  getVehicleByCustomer,
  getVehicleForLoggedInUser,
  getVehicleById,
  updateVehicle,
  updateVehicleStatus,
  deleteVehicle,
  getVehicleVinsByCustomer,
  updateVehicleOwner,
} = require("../controllers/vehicleController");
const { protect } = require("../middleware/protect");


// 🚗 Vehicle CRUD Routes
router.post("/", authenticate, createVehicle); // Create Vehicle
router.get("/", getAllVehicles); // Get All Vehicles
router.get("/by-customer/:customerId", getVehicleByCustomer);
router.get("/by-customer/:id/vins", getVehicleVinsByCustomer);

router.get("/me", protect, getVehicleForLoggedInUser);
router.get("/:id", getVehicleById); // Get Vehicle by ID
router.put("/:id", updateVehicle); // Full Vehicle Update (Auto Sync Shop-Ware)
router.put("/:id/status", updateVehicleStatus);
//router.patch("/:id/mileage", updateMileage); // Update Mileage (Auto Sync Shop-Ware)
router.delete("/:id", deleteVehicle); // Delete Vehicle
router.patch("/:id/owner", authenticate, authorizeOwnershipOrRole({model: Vehicle, allowedRoles: ["tenantAdmin", "Admin"],}), updateVehicleOwner);
// 📊 Search & Reports
//router.get("/search", searchVehicles); // Search Vehicles
//router.get("/reports", getVehicleReports); // Vehicle Reports

// 🌐 Manual Sync with Shop-Ware (Admin Only)
//router.post("/:id/shopware-sync", syncVehicleWithShopWare);

// Export Routes
module.exports = router;
