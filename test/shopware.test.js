const axios = require("axios");
const nock = require("nock");
const {
  createShopWareVehicle,
  getShopWareUserId,
  updateShopWareVehicle,
  getShopWareVehicleById,
  getAllShopWareVehiclesForTenant,
} = require("../controllers/shopWareController");
const logger = require("../utils/logger");

// Mock logger to prevent actual logging during tests
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

// ✅ Ensure Environment Variables Are Set Correctly
process.env.USER_BASE_URL = "http://localhost:5255/api/v2/admin/user";
process.env.SHOPWARE_API_URL = "https://api.shop-ware.com";
process.env.SHOPWARE_TENANT_ID = "test-tenant";
process.env.SHOPWARE_X_API_Partner_ID = "test-partner-id";
process.env.SHOPWARE_X_API_SECRET = "test-secret";

const SHOPWARE_AUTH_HEADERS = {
  "X-API-Partner-ID": process.env.SHOPWARE_X_API_Partner_ID,
  "X-API-SECRET": process.env.SHOPWARE_X_API_SECRET,
  "Content-Type": "application/json",
};

// ✅ Clean mocks after each test
afterEach(() => {
  nock.cleanAll();
  jest.clearAllMocks();
});

describe("Shop-Ware Controller", () => {
  describe("createShopWareVehicle", () => {
    it("✅ Should create a vehicle in Shop-Ware successfully", async () => {
      const userId = "12345";
      const shopwareUserId = "shopware-67890";
      const vehicleData = {
        vin: "1HGCM82633A123456",
        make: "Honda",
        model: "Accord",
        year: 2020,
        licensePlate: "XYZ123",
      };

      // ✅ Mock getShopWareUserId API Response
      nock(process.env.USER_BASE_URL)
        .get(`/${userId}`)
        .reply(200, { shopwareUserId });

      // ✅ Mock Shop-Ware Vehicle Creation Request with Headers
      nock(process.env.SHOPWARE_API_URL, { reqheaders: SHOPWARE_AUTH_HEADERS }) // 🔹 Ensure Headers Match
        .post(`/api/v1/tenants/${process.env.SHOPWARE_TENANT_ID}/vehicles`, {
          vin: vehicleData.vin,
          make: vehicleData.make,
          model: vehicleData.model,
          year: vehicleData.year,
          license_plate: vehicleData.licensePlate,
          customer_ids: [shopwareUserId],
        })
        .reply(201, { success: true, vehicleId: "vehicle-123" });

      const result = await createShopWareVehicle(vehicleData, userId);
      expect(result).toEqual({ success: true, vehicleId: "vehicle-123" });
      expect(logger.info).toHaveBeenCalled();
    });

    it("❌ Should throw an error if vehicle creation fails", async () => {
      const userId = "12345";
      const shopwareUserId = "shopware-67890";
      const vehicleData = {
        vin: "1HGCM82633A123456",
        make: "Honda",
        model: "Accord",
        year: 2020,
        licensePlate: "XYZ123",
      };

      nock(process.env.USER_BASE_URL)
        .get(`/${userId}`)
        .reply(200, { shopwareUserId });

      // ✅ Mock API Failure with Headers
      nock(process.env.SHOPWARE_API_URL, { reqheaders: SHOPWARE_AUTH_HEADERS })
        .post(`/api/v1/tenants/${process.env.SHOPWARE_TENANT_ID}/vehicles`)
        .reply(400, { message: "Invalid vehicle data" });

      await expect(createShopWareVehicle(vehicleData, userId)).rejects.toThrow(
        "Shop-Ware creation failed: Invalid vehicle data"
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("updateShopWareVehicle", () => {
    it("✅ Should successfully update a vehicle in Shop-Ware", async () => {
      const vehicleId = "vehicle-123";
      const updateData = { make: "Ford", model: "F-150", year: 2022 };

      // ✅ Mock API Request with Headers
      nock(process.env.SHOPWARE_API_URL, { reqheaders: SHOPWARE_AUTH_HEADERS })
        .put(
          `/api/v1/tenants/${process.env.SHOPWARE_TENANT_ID}/vehicles/${vehicleId}`
        )
        .reply(200, { success: true, updatedVehicle: updateData });

      const result = await updateShopWareVehicle(vehicleId, updateData);
      expect(result.success).toBe(true);
      expect(result.updatedVehicle.make).toBe("Ford");
      expect(result.updatedVehicle.model).toBe("F-150");
      expect(result.updatedVehicle.year).toBe(2022);
    });
  });

  describe("getShopWareVehicleById", () => {
    it("✅ Should fetch a vehicle by ID successfully", async () => {
      const vehicleId = "vehicle-123";
      const mockResponse = {
        vehicleId,
        make: "Honda",
        model: "Civic",
        year: 2021,
      };

      // ✅ Mock API Request with Headers
      nock(process.env.SHOPWARE_API_URL, { reqheaders: SHOPWARE_AUTH_HEADERS })
        .get(
          `/api/v1/tenants/${process.env.SHOPWARE_TENANT_ID}/vehicles/${vehicleId}`
        )
        .reply(200, mockResponse);

      const result = await getShopWareVehicleById(vehicleId);
      expect(result).toEqual(mockResponse);
    });
  });

  describe("getAllShopWareVehiclesForTenant", () => {
    it("✅ Should fetch all vehicles for a tenant", async () => {
      const mockResponse = [
        { vehicleId: "vehicle-1", make: "Ford", model: "Mustang" },
        { vehicleId: "vehicle-2", make: "Tesla", model: "Model 3" },
      ];

      // ✅ Mock API Request with Headers
      nock(process.env.SHOPWARE_API_URL, { reqheaders: SHOPWARE_AUTH_HEADERS })
        .get(`/api/v1/tenants/${process.env.SHOPWARE_TENANT_ID}/vehicles`)
        .reply(200, mockResponse);

      const result = await getAllShopWareVehiclesForTenant();
      expect(result).toEqual(mockResponse);
    });
  });
});
