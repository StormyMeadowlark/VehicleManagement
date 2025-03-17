// 🚗 1️⃣ Create Vehicle
// controllers/vehicleController.js
const Vehicle = require("../models/vehicleModel");
const { createShopWareVehicle } = require("./shopWareController");
const logger = require("../utils/logger");
const axios = require("axios")
const mongoose = require("mongoose")


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
    const { userId, vin, make, model, year } = req.body;

    // 🔹 1. Validate Required Fields
    if (!userId || !vin || !make || !model || !year) {
      console.log("❌ Missing required fields:", { userId, vin, make, model, year });
      return res.status(400).json({ message: "User ID, VIN, Make, Model, and Year are required." });
    }

    console.log("✅ Required fields validated, proceeding...");

    // 🔹 2. Fetch User and Tenant Data
    let tenantId, shopwareSyncEnabled;
    try {
      const userResponse = await axios.get(`${process.env.USER_BASE_URL}/users/${userId}`);
      tenantId = userResponse.data?.tenantId;

      if (!tenantId) {
        return res.status(404).json({ message: "User's tenant not found." });
      }

      const tenantResponse = await axios.get(`${process.env.TENANT_SERVICE_URL}/tenants/${tenantId}`);
      shopwareSyncEnabled = tenantResponse.data?.shopware?.enabled || false;

      console.log(`✅ Tenant ID: ${tenantId}, Shopware Sync Enabled: ${shopwareSyncEnabled}`);
    } catch (error) {
      console.error("❌ Error fetching user or tenant data:", error.message);
      return res.status(500).json({ message: "Failed to retrieve user or tenant data." });
    }

    // 🔹 3. Create Vehicle in Skynetrix Database
    const vehicle = new Vehicle({
      userId,
      vin,
      make,
      model,
      year,
      shopwareVehicleId: null, // Will update if Shopware sync is successful
    });

    await vehicle.save();
    console.log("✅ Vehicle saved to Skynetrix DB:", vehicle._id);

    // 🔹 4. Sync with Shopware (ONLY IF ENABLED)
    let shopwareVehicleId = null;

    if (shopwareSyncEnabled) {
      let shopwareUserId;
      try {
        const userResponse = await axios.get(`${process.env.USER_BASE_URL}/users/${userId}`);
        shopwareUserId = userResponse.data?.shopwareUserId;

        if (!shopwareUserId) {
          console.log("❌ Shopware User ID not found, skipping Shopware sync.");
        } else {
          console.log("✅ Retrieved Shopware User ID:", shopwareUserId);

          try {
            const shopwareResponse = await axios.post(
              `${SHOPWARE_BASE_URL}/api/v1/tenants/${process.env.SHOPWARE_TENANT_ID}/vehicles`,
              {
                vin,
                make,
                model,
                year,
                customer_ids: [shopwareUserId],
              },
              {
                headers: {
                  "X-Api-Partner-Id": SHOPWARE_X_API_PARTNER_ID,
                  "X-Api-Secret": SHOPWARE_X_API_SECRET,
                  "Content-Type": "application/json",
                },
              }
            );

            if (shopwareResponse.status === 201 && shopwareResponse.data?.vehicleId) {
              shopwareVehicleId = shopwareResponse.data.vehicleId;
              console.log("✅ Vehicle created in Shopware:", shopwareVehicleId);
            }
          } catch (error) {
            console.error("❌ Shopware sync failed:", error.response?.data || error.message);
          }
        }
      } catch (error) {
        console.error("❌ Error fetching Shopware user ID:", error.message);
      }
    }

    // 🔹 5. Update Vehicle in Skynetrix with Shopware Vehicle ID (if available)
    if (shopwareVehicleId) {
      vehicle.shopwareVehicleId = shopwareVehicleId;
      await vehicle.save();
    }

    // 🔹 6. Return Success Response
    res.status(201).json({
      message: "Vehicle created successfully.",
      vehicleId: vehicle._id,
      shopwareVehicleId: shopwareVehicleId || null,
      shopwareSyncStatus: shopwareSyncEnabled ? (shopwareVehicleId ? "Success" : "Failed") : "Not Enabled",
    });
  } catch (error) {
    console.error("❌ Vehicle creation error:", error);
    res.status(500).json({ message: "Internal server error during vehicle creation." });
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
        `${process.env.USER_BASE_URL}/users/${customerId}`
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
 * @route   GET /api/vehicles/:id
 * @access  Private (Requires Auth)
 */
const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch vehicle by ID
    const vehicle = await Vehicle.findById(id);

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    // Respond with the vehicle data
    return res.status(200).json(vehicle);
  } catch (error) {
    logger.error(`Failed to fetch vehicle with ID ${req.params.id}: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * @desc    Update a vehicle by ID and sync with Shop-Ware
 * @route   PUT /api/vehicles/:id
 * @access  Private (Requires Auth)
 */
const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find and update the vehicle
    const vehicle = await Vehicle.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    let shopWareResponse = null;
    if (vehicle.shopWareId) {
      try {
        shopWareResponse = await updateShopWareVehicle(vehicle.shopWareId, updateData);
      } catch (error) {
        logger.error(`Failed to update vehicle in Shop-Ware: ${error.message}`);
      }
    }

    return res.status(200).json({
      message: "Vehicle updated successfully",
      vehicle,
      shopWareResponse,
    });
  } catch (error) {
    logger.error(`Failed to update vehicle with ID ${req.params.id}: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
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
  //updateMileage,
  //deleteVehicle,
  //searchVehicles,
  //getVehicleReports,
  //syncVehicleWithShopWare,
};
