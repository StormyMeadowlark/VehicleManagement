const mongoose = require("mongoose");
const logger = require("../utils/logger"); // Import Winston logger

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout if no response within 5 seconds
    });

    logger.info("✅ MongoDB Connected...");
  } catch (err) {
    logger.error("❌ MongoDB connection error:", { message: err.message });

    // Retry connection after 5 seconds if failed
    setTimeout(connectDB, 5000);
  }
};

// Graceful Shutdown Handling
process.on("SIGINT", async () => {
  logger.warn("🛑 Closing MongoDB Connection...");
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = connectDB;
