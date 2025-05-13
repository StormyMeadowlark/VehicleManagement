// 🚗 1️⃣ Create Vehicle
// controllers/vehicleController.js
const Vehicle = require("../models/vehicleModel");
const { createShopWareVehicle } = require("./shopWareController");
const logger = require("../utils/logger");
const axios = require("axios")
const mongoose = require("mongoose")
const { usageQueue, addJob } = require("../utils/bullmq");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Shopware API Config
const SHOPWARE_BASE_URL = process.env.SHOPWARE_API_URL;
const SHOPWARE_X_API_PARTNER_ID = process.env.SHOPWARE_X_API_PARTNER_ID;
const SHOPWARE_X_API_SECRET = process.env.SHOPWARE_X_API_SECRET;

/**
 * @desc    Create a new vehicle in Skynetrix and sync with Shopware (if enabled)
 * @route   POST /api/v1/vehicles
 * @access  Private
 */
const createVehicle = async (req, res) => {
  console.log("🔹 Incoming vehicle creation request:", req.body);

  try {
    const { vin, make, model, year, userId: inputUserId } = req.body;
    const fallbackUserId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const tenantType = req.user?.tenantType;
    const userEmail = req.user?.email;
    const userRole = req.user?.userRole;
    const tier = req.user?.tier;


    const userId = inputUserId || fallbackUserId;

    // 🔒 Validate Required Fields
    if (!userId || !vin || !make || !model || !year) {
      console.log("❌ Missing required fields:", {
        userId,
        vin,
        make,
        model,
        year,
      });
      return res.status(400).json({
        message:
          "VIN, Make, Model, Year, Tenant ID and User ID (from body or token) are required.",
      });
    }
    console.log("🔍 Extracted tier from req.user:", tier);
    console.log("✅ Using user ID:", userId);
    console.log("✅ Using tenant ID:", tenantId);

    try {
      await addJob(usageQueue, {
        tenantId,
        tenantType,
        userId,
        userEmail,
        userRole,
        tier,
        microservice: "vehicle-management",
        action: "VEHICLE_CREATED",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Failed to add usage event job:", error);
    }


    // 🧾 Save vehicle to DB
    const vehicle = new Vehicle({
      userId,
      vin,
      make,
      model,
      year,
    });

    await vehicle.save();
    console.log("✅ Vehicle saved in MongoDB:", vehicle._id);

    // 🎯 Final Response
    return res.status(201).json({
      message: "Vehicle created successfully.",
      vehicleId: vehicle._id,
    });
  } catch (err) {
    console.error("❌ Vehicle creation error:", err.message);
    return res
      .status(500)
      .json({ message: "Internal server error during vehicle creation." });
  }
};

/**
 * @desc    Get all vehicles with dynamic filtering
 * @route   GET /api/vehicles/
 * @access  Public (Requires Auth in middleware if needed)
 */
const getAllVehicles = async (req, res) => {
  try {
    // Construct dynamic filter from query parameters
    const filter = {};
    for (const key in req.query) {
      if (req.query[key]) {
        filter[key] = req.query[key]; // Assign query params to filter
      }
    }

    // Standardize VIN to uppercase if provided
    if (filter.vin) {
      filter.vin = filter.vin.toUpperCase();
    }

    // Fetch vehicles from database based on filter
    const vehicles = await Vehicle.find(filter).select("-__v"); // Exclude version key

    return res.status(200).json({ count: vehicles.length, vehicles });
  } catch (error) {
    logger.error("Failed to fetch vehicles:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * @desc    Get vehicles by customer ID
 * @route   GET /api/v1/vehicles/by-customer/:customerId
 * @access  Private (Requires Auth)
 */
const getVehicleByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required." });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ message: "Invalid customer ID format." });
    }

    // Find all vehicles for this user
    const vehicles = await Vehicle.find({ userId: customerId })
      .select("vin make model year status")
      .lean();

    if (!vehicles || vehicles.length === 0) {
      return res
        .status(404)
        .json({ message: "No vehicles found for this user." });
    }

    return res.status(200).json({ count: vehicles.length, vehicles });
  } catch (error) {
    console.error("❌ Error in getVehicleByCustomer:", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

/**
 * @desc    Get vehicles for the logged-in user
 * @route   GET /api/v2/vehicles/me
 * @access  Private (Requires Auth)
 */
const getVehicleForLoggedInUser = async (req, res) => {
  console.log("🚀 Route hit: GET /api/v2/vehicles/me");

  try {
    const { id: userId } = req.user;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: no user ID." });
    }

    console.log("🔍 Looking up vehicles for user ID:", userId);

    // Query without converting userId
    const vehicles = await Vehicle.find({ userId }).lean();

    if (!vehicles || vehicles.length === 0) {
      return res
        .status(404)
        .json({ message: "No vehicles found for this user." });
    }

    console.log(`✅ Found ${vehicles.length} vehicle(s).`);
    return res.status(200).json({ count: vehicles.length, vehicles });
  } catch (err) {
    console.error("❌ Error fetching vehicles:", err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * @desc    Get a vehicle by ID
 * @route   GET /api/v1/vehicles/:id
 * @access  Private (Requires Auth)
 */
const getVehicleById = async (req, res) => {
  console.log("🚀 Route hit: GET /api/v1/vehicles/:id");

  try {
    const { id } = req.params;
    console.log(`🔍 Fetching vehicle with ID: ${id}`);

    // 🔹 1. Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("❌ Invalid vehicle ID format.");
      return res.status(400).json({ message: "Invalid vehicle ID format." });
    }

    // 🔹 2. Fetch vehicle from DB
    const vehicle = await Vehicle.findById(id).lean();
    if (!vehicle) {
      console.log("❌ Vehicle not found.");
      return res.status(404).json({ message: "Vehicle not found." });
    }

    console.log("✅ Vehicle found:", vehicle);
    
    // 🔹 3. Return vehicle data
    return res.status(200).json(vehicle);
  } catch (error) {
    console.error(`❌ Error fetching vehicle with ID ${req.params.id}:`, error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * @desc    Update a vehicle in Skynetrix and sync with Shopware (if applicable)
 * @route   PATCH /api/v1/vehicles/:id
 * @access  Private (Requires Auth)
 */
const updateVehicle = async (req, res) => {
  console.log("🚀 Route hit: PATCH /api/v1/vehicles/:id");

  try {
    const { id } = req.params;
    console.log(`🔍 Updating vehicle with ID: ${id}`);

    // 🔹 1. Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("❌ Invalid vehicle ID format.");
      return res.status(400).json({ message: "Invalid vehicle ID format." });
    }

    // 🔹 2. Extract Allowed Fields for Update
    const allowedUpdates = [
      "licensePlate",
      "registrationState",
      "currentMileage",
      "estimatedMilesPerYear",
      "purchaseDate",
      "warrantyExpiration",
      "lastServiceDate",
      "odometerAtLastService",
      "serviceDueMileage",
      "serviceAlert",
      "status",
      "ownershipType",
      "isFleetVehicle",
      "fleetNumber",
      "telematicsId",
      "userId",
      "shopWareId",
    ];

    const updateData = {};
    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      console.log("❌ No valid fields provided for update.");
      return res.status(400).json({ message: "No valid fields to update." });
    }

    console.log("🛠 Update payload:", updateData);

    // 🔹 3. Fetch Vehicle from DB
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      console.log("❌ Vehicle not found.");
      return res.status(404).json({ message: "Vehicle not found." });
    }

    // 🔹 4. Perform Update in Skynetrix
    Object.assign(vehicle, updateData);
    await vehicle.save();
    console.log("✅ Vehicle updated in Skynetrix:", vehicle);

    // 🔹 5. Sync with Shopware (if applicable)
    if (vehicle.shopWareId) {
      try {
        console.log(`🔄 Syncing updates with Shopware for vehicle ID: ${vehicle.shopWareId}`);

        const shopwareResponse = await axios.patch(
          `${SHOPWARE_BASE_URL}/api/v1/vehicles/${vehicle.shopWareId}`,
          {
            vin: vehicle.vin,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            licensePlate: vehicle.licensePlate,
            registrationState: vehicle.registrationState,
            currentMileage: vehicle.currentMileage,
            estimatedMilesPerYear: vehicle.estimatedMilesPerYear,
            purchaseDate: vehicle.purchaseDate,
            warrantyExpiration: vehicle.warrantyExpiration,
            lastServiceDate: vehicle.lastServiceDate,
            odometerAtLastService: vehicle.odometerAtLastService,
            serviceDueMileage: vehicle.serviceDueMileage,
            serviceAlert: vehicle.serviceAlert,
            status: vehicle.status,
            ownershipType: vehicle.ownershipType,
            isFleetVehicle: vehicle.isFleetVehicle,
            fleetNumber: vehicle.fleetNumber,
            telematicsId: vehicle.telematicsId,
          },
          {
            headers: {
              "X-Api-Partner-Id": SHOPWARE_X_API_PARTNER_ID,
              "X-Api-Secret": SHOPWARE_X_API_SECRET,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("✅ Shopware vehicle updated successfully:", shopwareResponse.data);
      } catch (error) {
        console.error("❌ Failed to update vehicle in Shopware:", error.response?.data || error.message);
        return res.status(500).json({ message: "Vehicle updated in Skynetrix but failed to sync with Shopware." });
      }
    }

    // 🔹 6. Return Success Response
    return res.status(200).json({
      message: "Vehicle updated successfully.",
      vehicle,
      shopwareSyncStatus: vehicle.shopWareId ? "Success" : "Not Synced",
    });
  } catch (error) {
    console.error(`❌ Error updating vehicle with ID ${req.params.id}:`, error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * @desc    Soft delete a vehicle by updating its status
 * @route   PUT /api/v1/vehicles/:id/status
 * @access  Private (Requires Auth)
 */
const updateVehicleStatus = async (req, res) => {
  console.log("🚀 Route hit: PUT /api/v1/vehicles/:id/status (Soft Delete)");

  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log(`🔍 Updating vehicle status. Vehicle ID: ${id}, New Status: ${status}`);

    // 🔹 1. Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("❌ Invalid vehicle ID format.");
      return res.status(400).json({ message: "Invalid vehicle ID format." });
    }

    // 🔹 2. Validate Status Value
    const validStatuses = ["inactive", "archived", "sold"];
    if (!validStatuses.includes(status)) {
      console.log("❌ Invalid status provided.");
      return res.status(400).json({ message: "Invalid status. Allowed values: inactive, archived, sold." });
    }

    // 🔹 3. Fetch Vehicle from DB
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      console.log("❌ Vehicle not found.");
      return res.status(404).json({ message: "Vehicle not found." });
    }

    // 🔹 4. Update Vehicle Status
    vehicle.status = status;
    await vehicle.save();

    console.log(`✅ Vehicle status updated successfully: ${status}`);

    // 🔹 5. Return Success Response
    return res.status(200).json({
      message: `Vehicle status updated to '${status}' successfully.`,
      vehicle,
    });
  } catch (error) {
    console.error(`❌ Error updating vehicle status with ID ${req.params.id}:`, error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * @desc    Permanently delete a vehicle from Skynetrix & Shopware (if applicable)
 * @route   DELETE /api/v1/vehicles/:id
 * @access  Private (Requires Auth)
 */
const deleteVehicle = async (req, res) => {
  console.log("🚀 Route hit: DELETE /api/v1/vehicles/:id (Hard Delete)");

  try {
    const { id } = req.params;

    console.log(`🔍 Deleting vehicle with ID: ${id}`);

    // 🔹 1. Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("❌ Invalid vehicle ID format.");
      return res.status(400).json({ message: "Invalid vehicle ID format." });
    }

    // 🔹 2. Fetch Vehicle from DB
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      console.log("❌ Vehicle not found.");
      return res.status(404).json({ message: "Vehicle not found." });
    }

    // 🔹 3. If Shopware Sync Exists, Delete from Shopware
    if (vehicle.shopWareId) {
      try {
        console.log(`🔄 Deleting vehicle from Shopware: ${vehicle.shopWareId}`);

        const shopwareResponse = await axios.delete(
          `${process.env.SHOPWARE_API_URL}/vehicles/${vehicle.shopWareId}`,
          {
            headers: {
              "X-Api-Partner-Id": process.env.SHOPWARE_X_API_PARTNER_ID,
              "X-Api-Secret": process.env.SHOPWARE_X_API_SECRET,
            },
          }
        );

        if (shopwareResponse.status === 200) {
          console.log("✅ Vehicle successfully deleted from Shopware.");
        } else {
          console.warn("⚠️ Unexpected response while deleting from Shopware.");
        }
      } catch (error) {
        console.error("❌ Failed to delete vehicle from Shopware:", error.response?.data || error.message);
        return res.status(500).json({ message: "Failed to delete vehicle from Shopware. Vehicle was not deleted from Skynetrix." });
      }
    }

    // 🔹 4. Delete Vehicle from Skynetrix DB
    await vehicle.deleteOne();
    console.log("✅ Vehicle successfully deleted from Skynetrix.");

    // 🔹 5. Return Success Response
    return res.status(200).json({
      message: "Vehicle deleted successfully.",
      deletedVehicleId: id,
      shopwareDeleted: !!vehicle.shopWareId, // Boolean: true if Shopware was deleted
    });
  } catch (error) {
    console.error(`❌ Error deleting vehicle with ID ${req.params.id}:`, error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getVehicleVinsByCustomer = async (req, res) => {
  try {
    const { id: customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required." });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ message: "Invalid customer ID format." });
    }

    // Find all vehicles for this user
    const vehicles = await Vehicle.find({ userId: customerId })
      .select("vin")
      .lean();

    if (!vehicles || vehicles.length === 0) {
      return res
        .status(404)
        .json({ message: "No vehicles found for this user." });
    }

    const vins = vehicles
      .map((v) => v.vin?.trim().toUpperCase())
      .filter(Boolean);

    return res.status(200).json({ count: vins.length, vins });
  } catch (error) {
    console.error("❌ Error in getVehicleVinsByCustomer:", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

/**
 * @desc    Transfer ownership of a vehicle to another user
 * @route   PATCH /api/v1/vehicles/:id/owner
 * @access  Private (Tenant Admin, Shop Owner, or Original Owner)
 */

const updateVehicleOwner = async (req, res) => {
  console.log("🚗 Vehicle ownership transfer request received.");

  try {
    const { id: vehicleId } = req.params;
    const { newUserId } = req.body;

    // 🔐 Validate input
    if (!vehicleId || !newUserId) {
      return res
        .status(400)
        .json({ message: "Vehicle ID and new user ID are required." });
    }

    if (
      !mongoose.Types.ObjectId.isValid(vehicleId) ||
      !mongoose.Types.ObjectId.isValid(newUserId)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid vehicle ID or user ID format." });
    }

    // 🔍 Find and update vehicle
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found." });
    }

    vehicle.userId = newUserId;
    await vehicle.save();

    console.log(
      `✅ Vehicle ${vehicle._id} ownership transferred to user ${newUserId}.`
    );

    return res.status(200).json({
      message: "Vehicle ownership transferred successfully.",
      vehicleId: vehicle._id,
      newOwnerId: newUserId,
    });
  } catch (err) {
    console.error("❌ Error transferring vehicle ownership:", err.message);
    return res
      .status(500)
      .json({ message: "Internal server error during ownership transfer." });
  }
};


// 🟢 Export All Controller Functions
module.exports = {
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
  //searchVehicles,
  //getVehicleReports,
};
