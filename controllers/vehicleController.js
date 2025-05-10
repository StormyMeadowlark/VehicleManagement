// 🚗 1️⃣ Create Vehicle
// controllers/vehicleController.js
const Vehicle = require("../models/vehicleModel");
const { createShopWareVehicle } = require("./shopWareController");
const logger = require("../utils/logger");
const axios = require("axios")
const mongoose = require("mongoose")
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
          "VIN, Make, Model, Year, and User ID (from body or token) are required.",
      });
    }

    console.log("✅ Using user ID:", userId);

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
 * @route   GET /api/vehicles/by-customer/:customerId
 * @access  Private (Requires Auth)
 */
const getVehicleByCustomer = async (req, res) => {
  console.log(
    "🔹 Incoming request to fetch vehicles for customer:",
    req.params
  );

  try {
    const { customerId } = req.params;

    // 🔹 1. Validate Customer ID
    if (!customerId) {
      console.log("❌ Missing customer ID.");
      return res.status(400).json({ message: "Customer ID is required." });
    }

    console.log(`✅ Received customer ID: ${customerId}`);

    let tenantId = null,
      shopwareSyncEnabled = false,
      userId = null;

    // 🔹 2. Fetch User and Tenant Data
    try {
      console.log(`🔍 Querying User Service for customer ID: ${customerId}...`);
      const userResponse = await axios.get(
        `${process.env.USER_BASE_URL}/${customerId}`
      );

      if (!userResponse.data || !userResponse.data.userId) {
        console.log("❌ User not found in User Service.");
        return res.status(404).json({ message: "Customer not found." });
      }

      userId = userResponse.data.userId;
      tenantId = userResponse.data.tenantId || null;
      console.log(`✅ Found user ID: ${userId}, Tenant ID: ${tenantId}`);

      if (tenantId) {
        console.log("🔍 Querying Tenant Service for Shopware sync...");
        const tenantResponse = await axios.get(
          `${process.env.TENANT_SERVICE_URL}/tenants/${tenantId}`
        );
        shopwareSyncEnabled = tenantResponse.data?.shopware?.enabled || false;
        console.log(`✅ Shopware Sync Enabled: ${shopwareSyncEnabled}`);
      }
    } catch (error) {
      console.error("❌ Error fetching user or tenant data:", error.message);
      return res
        .status(500)
        .json({ message: "Failed to retrieve customer or tenant data." });
    }

    // 🔹 3. Fetch Vehicles for User
    try {
      if (!userId) {
        console.log("❌ Error: No valid user ID found.");
        return res.status(404).json({ message: "Customer not found." });
      }

      console.log(`🔍 Fetching vehicles for user ID: ${userId}...`);

      const vehicles = await Vehicle.find({ userId })
        .select("vin make model year shopwareVehicleId")
        .lean();

      if (!vehicles || vehicles.length === 0) {
        console.log("⚠️ No vehicles found for this customer.");
        return res
          .status(404)
          .json({ message: "No vehicles found for this customer." });
      }

      console.log(`✅ Found ${vehicles.length} vehicle(s) for customer.`);
      return res.status(200).json({
        count: vehicles.length,
        vehicles,
        shopwareSyncEnabled,
      });
    } catch (error) {
      console.error("❌ Error fetching vehicles:", error.message);
      return res.status(500).json({ message: "Failed to retrieve vehicles." });
    }
  } catch (error) {
    console.error("❌ Unexpected error in getVehicleByCustomer:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * @desc    Get vehicles for the logged-in user
 * @route   GET /api/v2/vehicles/me
 * @access  Private (Requires Auth)
 */
const getVehicleForLoggedInUser = async (req, res) => {
  console.log("🚀 Route hit: GET /api/v2/vehicles/me"); // This should print


  try {
    console.log("🛠 JWT Payload:", req.user); // ✅ Log the JWT payload
    const { id: userId, email, role, tenantIds } = req.user;

    if (!userId) {
      console.log("🚫 No userId found in JWT.");
      return res
        .status(401)
        .json({ message: "Unauthorized. No user ID found." });
    }

    console.log(`🔍 Fetching vehicles for user: ${userId}`);
    console.log(`🔹 Tenant IDs: ${tenantIds.join(", ")}`);

    const queryUserId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    console.log("🔍 Using userId in query:", queryUserId);

    const vehicles = await Vehicle.find({ userId: queryUserId }).lean();
    console.log("🚗 Vehicles found:", vehicles);

    if (!vehicles.length) {
      console.log("⚠️ No vehicles found for this user.");
      return res
        .status(404)
        .json({ message: "No vehicles found for this user." });
    }

    console.log(`✅ Returning ${vehicles.length} vehicle(s) for the user.`);
    return res.status(200).json({ count: vehicles.length, vehicles });
  } catch (error) {
    console.error(`❌ Error fetching vehicles:`, error.message);
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
  getVehicleVinsByCustomer
  //searchVehicles,
  //getVehicleReports,
};
