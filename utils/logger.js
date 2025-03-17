// utils/logger.js
const winston = require("winston");
const path = require("path");

// Define Log Format
const logFormat = winston.format.printf(
  ({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  }
);

// Create Logger Instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info", // Default: info
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    logFormat
  ),
  transports: [
    // Console Transport (for development)
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
    // File Transport (for persistent storage)
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/combined.log"),
    }),
  ],
});

// Log Uncaught Exceptions and Rejections
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(__dirname, "../logs/exceptions.log"),
  })
);

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

// 🚀 Helper Functions
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Export Logger
module.exports = logger;
