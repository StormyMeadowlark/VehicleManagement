// routes/vehicleRoutes.js
const express = require("express");
const {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  //updateMileage,
  //deleteVehicle,
  //searchVehicles,
  //getVehicleReports,
  //syncVehicleWithShopWare,
  getVehicleByCustomer,
  getVehicleForLoggedInUser
} = require("../controllers/vehicleController");
const { protect } = require("../middleware/protect")
const router = express.Router();

// 🚗 Vehicle CRUD Routes
router.post("/", createVehicle); // Create Vehicle
router.get("/", getAllVehicles); // Get All Vehicles
router.get("/by-customer/:id", getVehicleByCustomer)
router.get("/me", protect, getVehicleForLoggedInUser)
router.get("/:id", getVehicleById); // Get Vehicle by ID
router.put("/:id", updateVehicle); // Full Vehicle Update (Auto Sync Shop-Ware)
//router.patch("/:id/mileage", updateMileage); // Update Mileage (Auto Sync Shop-Ware)
//router.delete("/:id", deleteVehicle); // Delete Vehicle

// 📊 Search & Reports
//router.get("/search", searchVehicles); // Search Vehicles
//router.get("/reports", getVehicleReports); // Vehicle Reports

// 🌐 Manual Sync with Shop-Ware (Admin Only)
//router.post("/:id/shopware-sync", syncVehicleWithShopWare);

// Export Routes
module.exports = router;
