const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");

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
} = require("../controllers/vehicleController");
const { protect } = require("../middleware/protect");


// 🚗 Vehicle CRUD Routes
router.post("/", authenticate, createVehicle); // Create Vehicle
router.get("/", getAllVehicles); // Get All Vehicles
router.get("/by-customer/:id", getVehicleByCustomer);
router.get("/by-customer/:id/vins", getVehicleVinsByCustomer);
router.get("/me", protect, getVehicleForLoggedInUser);
router.get("/:id", getVehicleById); // Get Vehicle by ID
router.put("/:id", updateVehicle); // Full Vehicle Update (Auto Sync Shop-Ware)
router.put("/:id/status", updateVehicleStatus);
//router.patch("/:id/mileage", updateMileage); // Update Mileage (Auto Sync Shop-Ware)
router.delete("/:id", deleteVehicle); // Delete Vehicle

// 📊 Search & Reports
//router.get("/search", searchVehicles); // Search Vehicles
//router.get("/reports", getVehicleReports); // Vehicle Reports

// 🌐 Manual Sync with Shop-Ware (Admin Only)
//router.post("/:id/shopware-sync", syncVehicleWithShopWare);

// Export Routes
module.exports = router;
