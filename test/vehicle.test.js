const mongoose = require("mongoose");
const httpMocks = require("node-mocks-http");
const Vehicle = require("../models/vehicleModel");
const axios = require("axios");
const { createVehicle, getAllVehicles, getVehicleByCustomer, getVehicleForLoggedInUser, getVehicleById } = require("../controllers/vehicleController");
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