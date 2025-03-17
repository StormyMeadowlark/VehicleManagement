const axios = require("axios");
const logger = require("../utils/logger");

const SHOPWARE_TENANT_ID = process.env.SHOPWARE_TENANT_ID;
const SHOPWARE_API_URL = process.env.SHOPWARE_API_URL;
const SHOPWARE_AUTH_HEADERS = {
  "X-API-Partner-ID": process.env.SHOPWARE_X_API_Partner_ID,
  "X-API-SECRET": process.env.SHOPWARE_X_API_SECRET,
  "Content-Type": "application/json",
};

/**
 * @desc    Get Shop-Ware User ID from user profile
 * @param   {String} userId - The logged-in user's ID
 * @returns {String} - Shop-Ware user ID
 */
const getShopWareUserId = async (userId) => {
  try {
    const userBaseUrl = process.env.USER_BASE_URL; // e.g., http://localhost:5255/api/v2/admin/user
    const response = await axios.get(`${userBaseUrl}/${userId}`);
    return response.data.shopwareUserId;
  } catch (error) {
    logger.error(
      `Failed to fetch Shop-Ware user ID for User ${userId}: ${
        error.response?.data?.message || error.message
      }`
    );
    throw new Error(`Could not retrieve Shop-Ware user ID: ${error.message}`);
  }
};

/**
 * @desc    Create a new vehicle in Shop-Ware
 * @param   {Object} vehicleData - Vehicle details
 * @param   {String} userId - The logged-in user's ID (to get shopwareUserId)
 * @returns {Object} - Response from Shop-Ware API
 */
const createShopWareVehicle = async (vehicleData, userId) => {
  try {
    const shopwareUserId = await getShopWareUserId(userId);

    const payload = {
      vin: vehicleData.vin,
      make: vehicleData.make,
      model: vehicleData.model,
      year: vehicleData.year,
      license_plate: vehicleData.licensePlate,
      customer_ids: [shopwareUserId],
    };

    const apiUrl = `${SHOPWARE_API_URL}/api/v1/tenants/${SHOPWARE_TENANT_ID}/vehicles`;

    const response = await axios.post(apiUrl, payload, {
      headers: SHOPWARE_AUTH_HEADERS,
    });

    logger.info(
      `Vehicle created in Shop-Ware for User ${shopwareUserId}, VIN: ${vehicleData.vin}`
    );
    return response.data;
  } catch (error) {
    logger.error(
      `Shop-Ware API error: ${error.response?.data?.message || error.message}`
    );
    throw new Error(`Shop-Ware creation failed: ${error.message}`);
  }
};


/**
 * @desc    Update vehicle in Shop-Ware
 * @param   {String} vehicleId - The Shop-Ware vehicle ID
 * @param   {Object} updateData - The updated vehicle data
 * @returns {Object} - Response from Shop-Ware API
 */
const updateShopWareVehicle = async (vehicleId, updateData) => {
  try {
    const apiUrl = `${SHOPWARE_API_URL}/api/v1/tenants/${SHOPWARE_TENANT_ID}/vehicles/${vehicleId}`;
    const response = await axios.put(apiUrl, updateData, {
      headers: SHOPWARE_AUTH_HEADERS,
    });

    logger.info(`Vehicle updated in Shop-Ware: ${vehicleId}`);
    return response.data;
  } catch (error) {
    logger.error(
      `Shop-Ware update error: ${
        error.response?.data?.message || error.message
      }`
    );
    throw new Error(`Shop-Ware update failed: ${error.message}`);
  }
};

/**
 * @desc    Get a vehicle by ID from Shop-Ware
 * @param   {String} vehicleId - The Shop-Ware vehicle ID
 * @returns {Object} - Vehicle details from Shop-Ware
 */
const getShopWareVehicleById = async (vehicleId) => {
  try {
    const apiUrl = `${SHOPWARE_API_URL}/api/v1/tenants/${SHOPWARE_TENANT_ID}/vehicles/${vehicleId}`;
    const response = await axios.get(apiUrl, {
      headers: SHOPWARE_AUTH_HEADERS,
    });

    logger.info(`Fetched vehicle from Shop-Ware: ${vehicleId}`);
    return response.data;
  } catch (error) {
    logger.error(
      `Error fetching vehicle from Shop-Ware: ${
        error.response?.data?.message || error.message
      }`
    );
    throw new Error(`Failed to get vehicle from Shop-Ware: ${error.message}`);
  }
};

/**
 * @desc    Get all vehicles for a tenant from Shop-Ware
 * @returns {Array} - List of vehicles
 */
const getAllShopWareVehiclesForTenant = async () => {
  try {
    const apiUrl = `${SHOPWARE_API_URL}/api/v1/tenants/${SHOPWARE_TENANT_ID}/vehicles`;
    const response = await axios.get(apiUrl, {
      headers: SHOPWARE_AUTH_HEADERS,
    });

    logger.info(`Fetched all vehicles for tenant ${SHOPWARE_TENANT_ID}`);
    return response.data;
  } catch (error) {
    logger.error(
      `Error fetching all vehicles from Shop-Ware: ${
        error.response?.data?.message || error.message
      }`
    );
    throw new Error(
      `Failed to get all vehicles from Shop-Ware: ${error.message}`
    );
  }
};

module.exports = {
  createShopWareVehicle,
  getShopWareUserId,
  updateShopWareVehicle,
  getShopWareVehicleById,
  getAllShopWareVehiclesForTenant,
};
