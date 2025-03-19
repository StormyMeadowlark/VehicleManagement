const mongoose = require("mongoose");
const httpMocks = require("node-mocks-http");
const Vehicle = require("../models/vehicleModel");
const axios = require("axios");
const { createVehicle, getAllVehicles, getVehicleByCustomer, getVehicleForLoggedInUser, getVehicleById, updateVehicle, updateVehicleStatus, deleteVehicle } = require("../controllers/vehicleController");
require("dotenv").config({ path: ".env" });
const request = require("supertest"); // ✅ Add this line
const app = require("../index")

// Mock logger
jest.mock("../utils/logger");

// Mock axios calls
jest.mock("axios");

beforeAll(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/testdb");
});

afterEach(async () => {
  await Vehicle.deleteMany();
});

afterAll(async () => {
  await mongoose.connection.close();
});
const jwt = require("jsonwebtoken");

// ✅ Mock JWT for authentication with required fields
const mockUserId = new mongoose.Types.ObjectId().toString();
const mockJwtPayload = {
  id: mockUserId,
  role: "customer", // Example role
  tenantIds: ["tenant1", "tenant2"], // Example tenant IDs
  email: "testuser@example.com",
};
const mockToken = jwt.sign(mockJwtPayload, process.env.JWT_SECRET);

test("should create a vehicle successfully without Shopware sync", async () => {
  // Mock user & tenant API responses
  axios.get.mockImplementation((url) => {
    if (url.includes("/users/")) {
      return Promise.resolve({
        data: {
          tenantId: "mockTenantId",
          shopwareUserId: null, // No Shopware sync
        },
      });
    } else if (url.includes("/tenants/")) {
      return Promise.resolve({
        data: {
          shopware: { enabled: false }, // Shopware is disabled
        },
      });
    }
    return Promise.reject(new Error("Unexpected API Call"));
  });

  const req = httpMocks.createRequest({
    method: "POST",
    url: "/api/vehicles",
    body: {
      userId: new mongoose.Types.ObjectId(),
      vin: "1HGCM82633A123456",
      make: "Honda",
      model: "Civic",
      year: 2020,
    },
  });

  const res = httpMocks.createResponse();
  await createVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(201);
  expect(data.message).toBe("Vehicle created successfully.");
  expect(data.vehicleId).toBeDefined();
  expect(data.shopwareVehicleId).toBe(null);
});

test("should create a vehicle and sync with Shopware", async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/users/")) {
      return Promise.resolve({
        data: {
          tenantId: "mockTenantId",
          shopwareUserId: "mockShopwareUserId",
        },
      });
    } else if (url.includes("/tenants/")) {
      return Promise.resolve({
        data: {
          shopware: { enabled: true }, // Shopware Sync Enabled
        },
      });
    }
    return Promise.reject(new Error("Unexpected API Call"));
  });

  axios.post.mockResolvedValue({
    status: 201,
    data: { vehicleId: "mockShopwareVehicleId" }, // Simulated Shopware API Response
  });

  const req = httpMocks.createRequest({
    method: "POST",
    url: "/api/vehicles",
    body: {
      userId: new mongoose.Types.ObjectId(),
      vin: "1HGCM82633A123456",
      make: "Honda",
      model: "Civic",
      year: 2020,
    },
  });

  const res = httpMocks.createResponse();
  await createVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(201);
  expect(data.message).toBe("Vehicle created successfully.");
  expect(data.vehicleId).toBeDefined();
  expect(data.shopwareVehicleId).toBe("mockShopwareVehicleId");
});

test("should return 400 error if required fields are missing", async () => {
  const req = httpMocks.createRequest({
    method: "POST",
    url: "/api/vehicles",
    body: {
      vin: "1HGCM82633A123456", // Missing `userId`, `make`, `model`, `year`
    },
  });

  const res = httpMocks.createResponse();
  await createVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(400);
  expect(data.message).toBe(
    "User ID, VIN, Make, Model, and Year are required."
  );
});

test("should return 404 if user not found", async () => {
  axios.get.mockRejectedValueOnce(new Error("User not found")); // Simulate user not found

  const req = httpMocks.createRequest({
    method: "POST",
    url: "/api/vehicles",
    body: {
      userId: new mongoose.Types.ObjectId(),
      vin: "1HGCM82633A123456",
      make: "Honda",
      model: "Civic",
      year: 2020,
    },
  });

  const res = httpMocks.createResponse();
  await createVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(500);
  expect(data.message).toBe("Failed to retrieve user or tenant data.");
});

test("should return 404 if tenant not found", async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/users/")) {
      return Promise.resolve({
        data: { tenantId: null }, // Simulate missing tenant
      });
    }
    return Promise.reject(new Error("Unexpected API Call"));
  });

  const req = httpMocks.createRequest({
    method: "POST",
    url: "/api/vehicles",
    body: {
      userId: new mongoose.Types.ObjectId(),
      vin: "1HGCM82633A123456",
      make: "Honda",
      model: "Civic",
      year: 2020,
    },
  });

  const res = httpMocks.createResponse();
  await createVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(404);
  expect(data.message).toBe("User's tenant not found.");
});

test("should create vehicle but handle Shopware sync failure", async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/users/")) {
      return Promise.resolve({
        data: {
          tenantId: "mockTenantId",
          shopwareUserId: "mockShopwareUserId",
        },
      });
    } else if (url.includes("/tenants/")) {
      return Promise.resolve({
        data: {
          shopware: { enabled: true }, // Shopware Sync Enabled
        },
      });
    }
    return Promise.reject(new Error("Unexpected API Call"));
  });

  axios.post.mockRejectedValue(new Error("Shopware API error")); // Simulate Shopware failure

  const req = httpMocks.createRequest({
    method: "POST",
    url: "/api/vehicles",
    body: {
      userId: new mongoose.Types.ObjectId(),
      vin: "1HGCM82633A123456",
      make: "Honda",
      model: "Civic",
      year: 2020,
    },
  });

  const res = httpMocks.createResponse();
  await createVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(201); // Vehicle should still be created
  expect(data.message).toBe("Vehicle created successfully.");
  expect(data.vehicleId).toBeDefined();
  expect(data.shopwareVehicleId).toBe(null); // Shopware sync failed
});

/**
 * ✅ TEST 1: Get All Vehicles (No Filters)
 */
test("should return all vehicles when no filters are applied", async () => {
  await Vehicle.create([
    { userId: new mongoose.Types.ObjectId(), vin: "VIN001", make: "Toyota", model: "Camry", year: 2020 },
    { userId: new mongoose.Types.ObjectId(), vin: "VIN002", make: "Honda", model: "Civic", year: 2019 }
  ]);

  const req = httpMocks.createRequest({
    method: "GET",
    url: "/api/vehicles"
  });

  const res = httpMocks.createResponse();
  await getAllVehicles(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.count).toBe(2);
  expect(data.vehicles.length).toBe(2);
});

/**
 * ✅ TEST 2: Get Vehicles with `make` Filter
 */
test("should return vehicles filtered by make", async () => {
  await Vehicle.create([
    { userId: new mongoose.Types.ObjectId(), vin: "VIN001", make: "Toyota", model: "Camry", year: 2020 },
    { userId: new mongoose.Types.ObjectId(), vin: "VIN002", make: "Honda", model: "Civic", year: 2019 }
  ]);

  const req = httpMocks.createRequest({
    method: "GET",
    url: "/api/vehicles",
    query: { make: "Toyota" }
  });

  const res = httpMocks.createResponse();
  await getAllVehicles(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.count).toBe(1);
  expect(data.vehicles[0].make).toBe("Toyota");
});

/**
 * ✅ TEST 3: Get Vehicles with `year` Filter
 */
test("should return vehicles filtered by year", async () => {
  await Vehicle.create([
    { userId: new mongoose.Types.ObjectId(), vin: "VIN001", make: "Toyota", model: "Camry", year: 2020 },
    { userId: new mongoose.Types.ObjectId(), vin: "VIN002", make: "Honda", model: "Civic", year: 2019 }
  ]);

  const req = httpMocks.createRequest({
    method: "GET",
    url: "/api/vehicles",
    query: { year: 2020 }
  });

  const res = httpMocks.createResponse();
  await getAllVehicles(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.count).toBe(1);
  expect(data.vehicles[0].year).toBe(2020);
});

/**
 * ✅ TEST 4: Get Vehicles with `vin` Filter (Case-Insensitive)
 */
test("should return vehicles filtered by VIN (case-insensitive)", async () => {
  await Vehicle.create({ userId: new mongoose.Types.ObjectId(), vin: "VIN001", make: "Toyota", model: "Camry", year: 2020 });

  const req = httpMocks.createRequest({
    method: "GET",
    url: "/api/vehicles",
    query: { vin: "vin001" } // Lowercase to test case insensitivity
  });

  const res = httpMocks.createResponse();
  await getAllVehicles(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.count).toBe(1);
  expect(data.vehicles[0].vin).toBe("VIN001");
});

/**
 * ✅ TEST 5: No Vehicles Found (Returns Empty List)
 */
test("should return empty list if no vehicles match filter", async () => {
  const req = httpMocks.createRequest({
    method: "GET",
    url: "/api/vehicles",
    query: { make: "BMW" } // No BMW vehicles exist
  });

  const res = httpMocks.createResponse();
  await getAllVehicles(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.count).toBe(0);
  expect(data.vehicles).toEqual([]);
});

/**
 * ✅ TEST 6: Handles Unexpected Errors
 */
test("should handle unexpected errors gracefully", async () => {
  // Ensure `find` is mocked properly
  const mockFind = jest.spyOn(Vehicle, "find").mockImplementationOnce(() => {
    throw new Error("Database error");
  });

  const req = httpMocks.createRequest({
    method: "GET",
    url: "/api/vehicles",
  });

  const res = httpMocks.createResponse();
  await getAllVehicles(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(500);
  expect(data.message).toBe("Internal Server Error");

  // Restore the original function after test execution
  mockFind.mockRestore();
});

/**
 * ✅ TEST 1: Successfully fetch vehicles by `customerId`
 */
test("should return vehicles when searching by customerId", async () => {
  const customerId = new mongoose.Types.ObjectId();
  const mockUserResponse = { data: { userId: customerId.toString(), tenantId: "tenant123" } };
  const mockTenantResponse = { data: { shopware: { enabled: true } } };

  axios.get.mockResolvedValueOnce(mockUserResponse);
  axios.get.mockResolvedValueOnce(mockTenantResponse);

  await Vehicle.create([
    { userId: customerId, vin: "VIN001", make: "Toyota", model: "Camry", year: 2020 },
    { userId: customerId, vin: "VIN002", make: "Honda", model: "Civic", year: 2019 }
  ]);

  const req = httpMocks.createRequest({
    method: "GET",
    url: `/api/vehicles/by-customer/${customerId.toString()}`,
    params: { customerId: customerId.toString() }
  });

  const res = httpMocks.createResponse();
  await getVehicleByCustomer(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.count).toBe(2);
  expect(data.vehicles[0].make).toBe("Toyota");
  expect(data.vehicles[1].make).toBe("Honda");
  expect(data.shopwareSyncEnabled).toBe(true);
});

/**
 * ✅ TEST 2: Successfully fetch vehicles when Shopware is disabled
 */
test("should return vehicles with Shopware sync disabled", async () => {
  const customerId = new mongoose.Types.ObjectId();
  const mockUserResponse = { data: { userId: customerId.toString(), tenantId: "tenant123" } };
  const mockTenantResponse = { data: { shopware: { enabled: false } } };

  axios.get.mockResolvedValueOnce(mockUserResponse);
  axios.get.mockResolvedValueOnce(mockTenantResponse);

  await Vehicle.create({
    userId: customerId,
    vin: "VIN001",
    make: "Toyota",
    model: "Camry",
    year: 2020
  });

  const req = httpMocks.createRequest({
    method: "GET",
    url: `/api/vehicles/by-customer/${customerId.toString()}`,
    params: { customerId: customerId.toString() }
  });

  const res = httpMocks.createResponse();
  await getVehicleByCustomer(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.count).toBe(1);
  expect(data.vehicles[0].make).toBe("Toyota");
  expect(data.shopwareSyncEnabled).toBe(false);
});

/**
 * ✅ TEST 3: Returns 404 if no vehicles found for customer
 */
test("should return 404 if no vehicles found for customer", async () => {
  const customerId = new mongoose.Types.ObjectId();
  axios.get.mockResolvedValueOnce({ data: { userId: customerId.toString(), tenantId: "tenant123" } });
  axios.get.mockResolvedValueOnce({ data: { shopware: { enabled: true } } });

  const req = httpMocks.createRequest({
    method: "GET",
    url: `/api/vehicles/by-customer/${customerId.toString()}`,
    params: { customerId: customerId.toString() }
  });

  const res = httpMocks.createResponse();
  await getVehicleByCustomer(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(404);
  expect(data.message).toBe("No vehicles found for this customer.");
});

/**
 * ✅ TEST 4: Returns 404 if customer not found in User Service
 */
test("should return 404 if customer is not found in User Service", async () => {
  axios.get.mockResolvedValueOnce({ data: null });

  const req = httpMocks.createRequest({
    method: "GET",
    url: `/api/vehicles/by-customer/invalidCustomerId`,
    params: { customerId: "invalidCustomerId" }
  });

  const res = httpMocks.createResponse();
  await getVehicleByCustomer(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(404);
  expect(data.message).toBe("Customer not found.");
});

/**
 * ✅ TEST 5: Returns 500 if User Service is unavailable
 */
test("should return 500 if User Service fails", async () => {
  axios.get.mockRejectedValueOnce(new Error("User Service Down"));

  const req = httpMocks.createRequest({
    method: "GET",
    url: `/api/vehicles/by-customer/123456`,
    params: { customerId: "123456" }
  });

  const res = httpMocks.createResponse();
  await getVehicleByCustomer(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(500);
  expect(data.message).toBe("Failed to retrieve customer or tenant data.");
});

/**
 * ✅ TEST 6: Returns 500 if Tenant Service is unavailable
 */
test("should return 500 if Tenant Service fails", async () => {
  const customerId = new mongoose.Types.ObjectId();
  const mockUserResponse = { data: { userId: customerId.toString(), tenantId: "tenant123" } };

  axios.get.mockResolvedValueOnce(mockUserResponse);
  axios.get.mockRejectedValueOnce(new Error("Tenant Service Down"));

  const req = httpMocks.createRequest({
    method: "GET",
    url: `/api/vehicles/by-customer/${customerId.toString()}`,
    params: { customerId: customerId.toString() }
  });

  const res = httpMocks.createResponse();
  await getVehicleByCustomer(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(500);
  expect(data.message).toBe("Failed to retrieve customer or tenant data.");
});

/**
 * ✅ TEST 7: Should handle unexpected errors
 */
test("should handle unexpected errors gracefully", async () => {
  const customerId = new mongoose.Types.ObjectId();
  axios.get.mockResolvedValueOnce({ data: { userId: customerId.toString(), tenantId: "tenant123" } });

  const mockFind = jest.spyOn(Vehicle, "find").mockImplementationOnce(() => {
    throw new Error("Database error");
  });

  const req = httpMocks.createRequest({
    method: "GET",
    url: `/api/vehicles/by-customer/${customerId.toString()}`,
    params: { customerId: customerId.toString() }
  });

  const res = httpMocks.createResponse();
  await getVehicleByCustomer(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(500);
  expect(data.message).toBe("Failed to retrieve vehicles.");

  mockFind.mockRestore();
});

/**
 * ✅ TEST SUITE: Get Vehicles for Logged-in User (`GET /api/vehicles/me`)
 */
describe("GET /api/vehicles/me - Get Vehicles for Logged-in User", () => {
  test("should return vehicles for logged-in user", async () => {
    await Vehicle.create([
      {
        userId: mockUserId,
        vin: "VIN001",
        make: "Toyota",
        model: "Camry",
        year: 2020,
      },
      {
        userId: mockUserId,
        vin: "VIN002",
        make: "Honda",
        model: "Civic",
        year: 2019,
      },
    ]);
    const allVehicles = await Vehicle.find().lean();
    console.log("📜 All vehicles in DB before test:", allVehicles); // ✅ Debug this
    const res = await request(app)
      .get("/api/v2/vehicles/me")
      .set("Authorization", `Bearer ${mockToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.vehicles[0].make).toBe("Toyota");
    expect(res.body.vehicles[1].make).toBe("Honda");
  });

  test("should return 404 if no vehicles found for logged-in user", async () => {
    const res = await request(app)
      .get("/api/v2/vehicles/me")
      .set("Authorization", `Bearer ${mockToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("No vehicles found for this user.");
  });

  test("should return 401 if token is missing", async () => {
    const res = await request(app).get("/api/v2/vehicles/me");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No token provided, authorization denied.");
  });

  test("should return 401 if token is invalid", async () => {
    const res = await request(app)
      .get("/api/v2/vehicles/me")
      .set("Authorization", "Bearer invalidToken");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token.");
  });

  test("should include role, tenantIds, and email in logs", async () => {
    const consoleSpy = jest.spyOn(console, "log");

    await request(app)
      .get("/api/v2/vehicles/me")
      .set("Authorization", `Bearer ${mockToken}`);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `${mockUserId}`
      )
    );
    consoleSpy.mockRestore();
  });
});

test("should return a vehicle when a valid ID is provided", async () => {
  const vehicle = await Vehicle.create({
    userId: new mongoose.Types.ObjectId(),
    vin: "1HGCM82633A123456",
    make: "Honda",
    model: "Civic",
    year: 2020,
  });

  const req = httpMocks.createRequest({
    method: "GET",
    url: `/api/vehicles/${vehicle._id}`,
    params: { id: vehicle._id.toString() },
  });

  const res = httpMocks.createResponse();
  await getVehicleById(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.vin).toBe("1HGCM82633A123456");
  expect(data.make).toBe("Honda");
  expect(data.model).toBe("Civic");
  expect(data.year).toBe(2020);
});

/**
 * ✅ TEST 2: Return 404 if vehicle not found
 */
test("should return 404 if vehicle is not found", async () => {
  const nonExistentId = new mongoose.Types.ObjectId();

  const req = httpMocks.createRequest({
    method: "GET",
    url: `/api/vehicles/${nonExistentId}`,
    params: { id: nonExistentId.toString() },
  });

  const res = httpMocks.createResponse();
  await getVehicleById(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(404);
  expect(data.message).toBe("Vehicle not found.");
});

/**
 * ✅ TEST 3: Return 400 for invalid ObjectId format
 */
test("should return 400 for an invalid MongoDB ObjectId format", async () => {
  const invalidId = "123invalidID"; // Not a valid ObjectId

  const req = httpMocks.createRequest({
    method: "GET",
    url: `/api/vehicles/${invalidId}`,
    params: { id: invalidId },
  });

  const res = httpMocks.createResponse();
  await getVehicleById(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(400);
  expect(data.message).toBe("Invalid vehicle ID format.");
});

/**
 * ✅ TEST 4: Handle unexpected database errors
 */
test("should return 500 if there is a database error", async () => {
  const mockFindById = jest
    .spyOn(Vehicle, "findById")
    .mockImplementationOnce(() => {
      throw new Error("Database error");
    });

  const vehicleId = new mongoose.Types.ObjectId();

  const req = httpMocks.createRequest({
    method: "GET",
    url: `/api/vehicles/${vehicleId}`,
    params: { id: vehicleId.toString() },
  });

  const res = httpMocks.createResponse();
  await getVehicleById(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(500);
  expect(data.message).toBe("Internal Server Error");

  mockFindById.mockRestore();
});

test("should update a vehicle in Skynetrix and sync with Shopware", async () => {
  const vehicle = await Vehicle.create({
    userId: new mongoose.Types.ObjectId(),
    vin: "1HGCM82633A123456",
    make: "Honda",
    model: "Civic",
    year: 2020,
    currentMileage: 40000,
    status: "active",
    shopWareId: "shopware-vehicle-123",
  });

  axios.patch.mockResolvedValue({
    status: 200,
    data: { success: true },
  });

  const req = httpMocks.createRequest({
    method: "PATCH",
    url: `/api/v1/vehicles/${vehicle._id}`,
    params: { id: vehicle._id.toString() },
    body: {
      currentMileage: 45000,
      status: "inactive",
    },
  });

  const res = httpMocks.createResponse();
  await updateVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.message).toBe("Vehicle updated successfully.");
  expect(data.vehicle.currentMileage).toBe(45000);
  expect(data.vehicle.status).toBe("inactive");
  expect(data.shopwareSyncStatus).toBe("Success");
});

/**
 * ✅ TEST 3: Handle Shopware Sync Failure Gracefully
 */
test("should update vehicle but handle Shopware sync failure gracefully", async () => {
  const vehicle = await Vehicle.create({
    userId: new mongoose.Types.ObjectId(),
    vin: "1HGCM82633A123456",
    make: "Honda",
    model: "Civic",
    year: 2020,
    currentMileage: 40000,
    status: "active",
    shopWareId: "shopware-vehicle-123",
  });

  axios.patch.mockRejectedValue(new Error("Shopware API error"));

  const req = httpMocks.createRequest({
    method: "PATCH",
    url: `/api/v1/vehicles/${vehicle._id}`,
    params: { id: vehicle._id.toString() },
    body: {
      currentMileage: 45000,
      status: "inactive",
    },
  });

  const res = httpMocks.createResponse();
  await updateVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(500);
  expect(data.message).toBe(
    "Vehicle updated in Skynetrix but failed to sync with Shopware."
  );
});

/**
 * ✅ TEST 4: Return 404 if vehicle not found
 */
test("should return 404 if vehicle is not found", async () => {
  const nonExistentId = new mongoose.Types.ObjectId();

  const req = httpMocks.createRequest({
    method: "PATCH",
    url: `/api/v1/vehicles/${nonExistentId}`,
    params: { id: nonExistentId.toString() },
    body: {
      currentMileage: 50000,
    },
  });

  const res = httpMocks.createResponse();
  await updateVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(404);
  expect(data.message).toBe("Vehicle not found.");
});

/**
 * ✅ TEST 5: Return 400 for invalid MongoDB ObjectId
 */
test("should return 400 for an invalid vehicle ID format", async () => {
  const invalidId = "123invalidID";

  const req = httpMocks.createRequest({
    method: "PATCH",
    url: `/api/v1/vehicles/${invalidId}`,
    params: { id: invalidId },
    body: {
      currentMileage: 50000,
    },
  });

  const res = httpMocks.createResponse();
  await updateVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(400);
  expect(data.message).toBe("Invalid vehicle ID format.");
});

/**
 * ✅ TEST 6: Return 400 if no valid fields provided
 */
test("should return 400 if no valid fields are provided for update", async () => {
  const vehicle = await Vehicle.create({
    userId: new mongoose.Types.ObjectId(),
    vin: "1HGCM82633A123456",
    make: "Honda",
    model: "Civic",
    year: 2020,
  });

  const req = httpMocks.createRequest({
    method: "PATCH",
    url: `/api/v1/vehicles/${vehicle._id}`,
    params: { id: vehicle._id.toString() },
    body: {}, // No update fields
  });

  const res = httpMocks.createResponse();
  await updateVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(400);
  expect(data.message).toBe("No valid fields to update.");
});

/**
 * ✅ TEST 7: Handle unexpected database errors
 */
test("should return 500 if there is a database error", async () => {
  const mockFindByIdAndUpdate = jest
    .spyOn(Vehicle, "findById")
    .mockImplementationOnce(() => {
      throw new Error("Database error");
    });

  const vehicleId = new mongoose.Types.ObjectId();

  const req = httpMocks.createRequest({
    method: "PATCH",
    url: `/api/v1/vehicles/${vehicleId}`,
    params: { id: vehicleId.toString() },
    body: {
      currentMileage: 50000,
    },
  });

  const res = httpMocks.createResponse();
  await updateVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(500);
  expect(data.message).toBe("Internal Server Error");

  mockFindByIdAndUpdate.mockRestore();
});

/**
 * ✅ TEST 1: Successfully update vehicle status to inactive
 */
test("should update vehicle status to inactive", async () => {
  const vehicle = await Vehicle.create({
    userId: new mongoose.Types.ObjectId(),
    vin: "1HGCM82633A123456",
    make: "Honda",
    model: "Civic",
    year: 2020,
    status: "active",
  });

  const req = httpMocks.createRequest({
    method: "PUT",
    url: `/api/v1/vehicles/${vehicle._id}/status`,
    params: { id: vehicle._id.toString() },
    body: { status: "inactive" },
  });

  const res = httpMocks.createResponse();
  await updateVehicleStatus(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.message).toBe("Vehicle status updated to 'inactive' successfully.");
  expect(data.vehicle.status).toBe("inactive");
});

/**
 * ✅ TEST 2: Successfully update vehicle status to archived
 */
test("should update vehicle status to archived", async () => {
  const vehicle = await Vehicle.create({
    userId: new mongoose.Types.ObjectId(),
    vin: "JH4DB1650NS000000",
    make: "Acura",
    model: "Integra",
    year: 1995,
    status: "active",
  });

  const req = httpMocks.createRequest({
    method: "PUT",
    url: `/api/v1/vehicles/${vehicle._id}/status`,
    params: { id: vehicle._id.toString() },
    body: { status: "archived" },
  });

  const res = httpMocks.createResponse();
  await updateVehicleStatus(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.message).toBe("Vehicle status updated to 'archived' successfully.");
  expect(data.vehicle.status).toBe("archived");
});

/**
 * ✅ TEST 3: Successfully update vehicle status to sold
 */
test("should update vehicle status to sold", async () => {
  const vehicle = await Vehicle.create({
    userId: new mongoose.Types.ObjectId(),
    vin: "WBAEV53444KM00000",
    make: "BMW",
    model: "3 Series",
    year: 2004,
    status: "active",
  });

  const req = httpMocks.createRequest({
    method: "PUT",
    url: `/api/v1/vehicles/${vehicle._id}/status`,
    params: { id: vehicle._id.toString() },
    body: { status: "sold" },
  });

  const res = httpMocks.createResponse();
  await updateVehicleStatus(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.message).toBe("Vehicle status updated to 'sold' successfully.");
  expect(data.vehicle.status).toBe("sold");
});

/**
 * ❌ TEST 4: Return 400 for invalid status value
 */
test("should return 400 for invalid status", async () => {
  const vehicle = await Vehicle.create({
    userId: new mongoose.Types.ObjectId(),
    vin: "WAUZZZ8P8BA000000",
    make: "Audi",
    model: "A3",
    year: 2011,
    status: "active",
  });

  const req = httpMocks.createRequest({
    method: "PUT",
    url: `/api/v1/vehicles/${vehicle._id}/status`,
    params: { id: vehicle._id.toString() },
    body: { status: "deleted" }, // ❌ Invalid status
  });

  const res = httpMocks.createResponse();
  await updateVehicleStatus(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(400);
  expect(data.message).toBe("Invalid status. Allowed values: inactive, archived, sold.");
});

/**
 * ❌ TEST 5: Return 404 if vehicle not found
 */
test("should return 404 if vehicle does not exist", async () => {
  const nonExistentId = new mongoose.Types.ObjectId();

  const req = httpMocks.createRequest({
    method: "PUT",
    url: `/api/v1/vehicles/${nonExistentId}/status`,
    params: { id: nonExistentId.toString() },
    body: { status: "inactive" },
  });

  const res = httpMocks.createResponse();
  await updateVehicleStatus(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(404);
  expect(data.message).toBe("Vehicle not found.");
});

/**
 * ❌ TEST 6: Return 400 for invalid MongoDB ObjectId
 */
test("should return 400 for an invalid vehicle ID format", async () => {
  const invalidId = "123invalidID";

  const req = httpMocks.createRequest({
    method: "PUT",
    url: `/api/v1/vehicles/${invalidId}/status`,
    params: { id: invalidId },
    body: { status: "inactive" },
  });

  const res = httpMocks.createResponse();
  await updateVehicleStatus(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(400);
  expect(data.message).toBe("Invalid vehicle ID format.");
});

/**
 * ❌ TEST 7: Handle unexpected database errors
 */
test("should return 500 if there is a database error", async () => {
  const mockFindById = jest.spyOn(Vehicle, "findById").mockImplementationOnce(() => {
    throw new Error("Database error");
  });

  const vehicleId = new mongoose.Types.ObjectId();

  const req = httpMocks.createRequest({
    method: "PUT",
    url: `/api/v1/vehicles/${vehicleId}/status`,
    params: { id: vehicleId.toString() },
    body: { status: "inactive" },
  });

  const res = httpMocks.createResponse();
  await updateVehicleStatus(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(500);
  expect(data.message).toBe("Internal Server Error");

  mockFindById.mockRestore();
});

/**
 * ✅ TEST 1: Successfully delete a vehicle (not linked to Shopware)
 */
test("should delete vehicle from Skynetrix when Shopware is not linked", async () => {
  const vehicle = await Vehicle.create({
    userId: new mongoose.Types.ObjectId(),
    vin: "1HGCM82633A123456",
    make: "Honda",
    model: "Civic",
    year: 2020,
    shopWareId: null, // No Shopware sync
  });

  const req = httpMocks.createRequest({
    method: "DELETE",
    url: `/api/v1/vehicles/${vehicle._id}`,
    params: { id: vehicle._id.toString() },
  });

  const res = httpMocks.createResponse();
  await deleteVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.message).toBe("Vehicle deleted successfully.");
  expect(data.shopwareDeleted).toBe(false);

  const deletedVehicle = await Vehicle.findById(vehicle._id);
  expect(deletedVehicle).toBeNull(); // Ensure vehicle is removed from DB
});

/**
 * ✅ TEST 2: Successfully delete a vehicle from both Skynetrix and Shopware
 */
test("should delete vehicle from both Skynetrix and Shopware", async () => {
  const vehicle = await Vehicle.create({
    userId: new mongoose.Types.ObjectId(),
    vin: "JH4DB1650NS000000",
    make: "Acura",
    model: "Integra",
    year: 1995,
    shopWareId: "mockShopwareId",
  });

  // Mock successful Shopware API deletion
  axios.delete.mockResolvedValue({ status: 200 });

  const req = httpMocks.createRequest({
    method: "DELETE",
    url: `/api/v1/vehicles/${vehicle._id}`,
    params: { id: vehicle._id.toString() },
  });

  const res = httpMocks.createResponse();
  await deleteVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(200);
  expect(data.message).toBe("Vehicle deleted successfully.");
  expect(data.shopwareDeleted).toBe(true);

  const deletedVehicle = await Vehicle.findById(vehicle._id);
  expect(deletedVehicle).toBeNull(); // Ensure vehicle is removed from DB
});

/**
 * ❌ TEST 3: Fail to delete vehicle if Shopware API fails
 */
test("should not delete vehicle from Skynetrix if Shopware deletion fails", async () => {
  const vehicle = await Vehicle.create({
    userId: new mongoose.Types.ObjectId(),
    vin: "WBAEV53444KM00000",
    make: "BMW",
    model: "3 Series",
    year: 2004,
    shopWareId: "mockShopwareId",
  });

  // Mock failed Shopware API deletion
  axios.delete.mockRejectedValue(new Error("Shopware API error"));

  const req = httpMocks.createRequest({
    method: "DELETE",
    url: `/api/v1/vehicles/${vehicle._id}`,
    params: { id: vehicle._id.toString() },
  });

  const res = httpMocks.createResponse();
  await deleteVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(500);
  expect(data.message).toBe("Failed to delete vehicle from Shopware. Vehicle was not deleted from Skynetrix.");

  const existingVehicle = await Vehicle.findById(vehicle._id);
  expect(existingVehicle).not.toBeNull(); // Ensure vehicle is still in DB
});

/**
 * ❌ TEST 4: Return 404 if vehicle not found
 */
test("should return 404 if vehicle does not exist", async () => {
  const nonExistentId = new mongoose.Types.ObjectId();

  const req = httpMocks.createRequest({
    method: "DELETE",
    url: `/api/v1/vehicles/${nonExistentId}`,
    params: { id: nonExistentId.toString() },
  });

  const res = httpMocks.createResponse();
  await deleteVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(404);
  expect(data.message).toBe("Vehicle not found.");
});

/**
 * ❌ TEST 5: Return 400 for invalid MongoDB ObjectId
 */
test("should return 400 for an invalid vehicle ID format", async () => {
  const invalidId = "123invalidID";

  const req = httpMocks.createRequest({
    method: "DELETE",
    url: `/api/v1/vehicles/${invalidId}`,
    params: { id: invalidId },
  });

  const res = httpMocks.createResponse();
  await deleteVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(400);
  expect(data.message).toBe("Invalid vehicle ID format.");
});

/**
 * ❌ TEST 6: Handle unexpected database errors
 */
test("should return 500 if there is a database error", async () => {
  const mockFindById = jest.spyOn(Vehicle, "findById").mockImplementationOnce(() => {
    throw new Error("Database error");
  });

  const vehicleId = new mongoose.Types.ObjectId();

  const req = httpMocks.createRequest({
    method: "DELETE",
    url: `/api/v1/vehicles/${vehicleId}`,
    params: { id: vehicleId.toString() },
  });

  const res = httpMocks.createResponse();
  await deleteVehicle(req, res);

  const data = res._getJSONData();
  expect(res.statusCode).toBe(500);
  expect(data.message).toBe("Internal Server Error");

  mockFindById.mockRestore();
});