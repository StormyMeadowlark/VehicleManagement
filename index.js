const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const morgan = require("morgan");
const logger = require("./utils/logger"); // Import Winston logger
const config = require("./config"); // Centralized config
const connectDB = require("./config/db");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swaggerConfig");
const client = require("prom-client");
const logRequestMiddleware = require("./middleware/logger");
const { DateTime, IANAZone } = require("luxon");
const redis = require("./config/redis");
const mongoose = require("mongoose");
const vehicleRoutes = require("./routes/vehicleRoutes");

// Initialize Express
const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logRequestMiddleware);

// Use Morgan with Winston
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// MongoDB Connection
connectDB()
  .then(() => logger.info("✅ MongoDB Connected"))
  .catch((err) =>
    logger.error("❌ MongoDB Connection Error", { error: err.message })
  );

//Redis Connection
redis.on("connect", () => {
  logger.info("✅ Redis connected");
});

redis.on("error", (err) => {
  logger.error("❌ Redis connection error", { error: err.message });
});

// API Versioning
const API_BASE = "/api/v1";
app.use(
  `${API_BASE}/vehicle-management/docs`,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

app.use((req, res, next) => {
  logger.httpRequest(req, "Incoming request");
  next();
});


// Test Route
app.get("/", (req, res) => {
  logger.info("Health check - root endpoint accessed");
  res.status(200).json({ message: "Vehicle Management API is running!" });
});

app.get("/health/mongo", (req, res) => {
  const mongoState = mongoose.connection.readyState;

  if (mongoState === 1) {
    logger.info("✅ MongoDB is connected");
    return res
      .status(200)
      .json({ success: true, message: "MongoDB is connected" });
  } else {
    logger.error("❌ MongoDB is not connected");
    return res
      .status(500)
      .json({ success: false, message: "MongoDB is not connected" });
  }
});

// Redis Health Route
app.get("/health/redis", async (req, res) => {
  try {
    await redis.ping();
    logger.info("✅ Redis is connected");
    res.status(200).json({ success: true, message: "Redis is connected" });
  } catch (err) {
    logger.error("❌ Redis is not connected", { error: err.message });
    res.status(500).json({ success: false, message: "Redis is not connected" });
  }
});

// Health Check Route
app.get("/health", (req, res) => {
  const tzHeader = req.headers["x-timezone"];
  const timezone = IANAZone.isValidZone(tzHeader) ? tzHeader : "UTC";

  const serverNow = DateTime.now();
  const clientTime = serverNow.setZone(timezone);

  logger.info("Health check - /health endpoint accessed", {
    clientTime: clientTime.toISO(),
    timezone,
    requestIp: req.ip,
  });

  res.status(200).json({
    status: "Healthy",
    serverTimeUTC: serverNow.toISO(),
    clientTime: clientTime.toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS),
    timezoneUsed: timezone,
  });
});

app.use(`${API_BASE}/vehicles`, vehicleRoutes);

// Create a Registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Expose Metrics Endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// 🚨 Centralized Error Handler
app.use((err, req, res, next) => {
  logger.error("🚨 Error Occurred", {
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: err.stack,
  });

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

// Start Server Only When Not in Test Mode
if (require.main === module) {
  app.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT}`);
  });
}

// Export the app for testing
module.exports = app;
