// routes/shopWareRoutes.js
const express = require("express");
const {
  getShopWareVehicle,
  createShopWareVehicle,
  updateShopWareVehicle,
  deleteShopWareVehicle,
} = require("../controllers/shopWareController");

const router = express.Router();

// 🌐 Shop-Ware Integration Routes
router.get("/:id", getShopWareVehicle); // Get Vehicle from Shop-Ware
router.post("/:id", createShopWareVehicle); // Create Vehicle in Shop-Ware
router.put("/:id", updateShopWareVehicle); // Update Vehicle in Shop-Ware
router.delete("/:id", deleteShopWareVehicle); // Delete Vehicle from Shop-Ware

// Export Routes
module.exports = router;
