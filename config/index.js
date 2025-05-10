const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const requiredEnvVars = ["MONGO_URI", "PORT"];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1); // Exit process if critical variables are missing
  }
});

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI,
  LOG_LEVEL: process.env.LOG_LEVEL || "info", // Allows setting different logging levels
};
