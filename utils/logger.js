const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const UAParser = require("ua-parser-js");
const parser = new UAParser();

// ✅ ONLY Include Logstash if ELK is enabled
const logstashTransport =
  process.env.ENABLE_ELK === "true"
    ? new winston.transports.Http({
        host: process.env.ELK_HOST || "elk-stack",
        port: process.env.ELK_PORT || 5044,
        path: "/",
        ssl: false,
        format: winston.format.json(),
      })
    : null;

// ✅ Define Log Format (Structured JSON)
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.json()
);

// ✅ Transports (Console + File + Optional Logstash)
const transports = [
  new winston.transports.Console({
    level: process.env.NODE_ENV === "production" ? "warn" : "debug",
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
  new DailyRotateFile({
    filename: path.join(__dirname, "../logs/application-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "14d",
    level: "info",
  }),
  new DailyRotateFile({
    filename: path.join(__dirname, "../logs/error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "30d",
    level: "error",
  }),
];

if (logstashTransport) transports.push(logstashTransport);

// ✅ Create Logger
const logger = winston.createLogger({
  level: "info",
  format: logFormat,
  transports,
  exitOnError: false,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/exceptions.log"),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/rejections.log"),
    }),
  ],
});

// ✅ Smart log level based on status
function determineLevel(statusCode) {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "warn";
  return "info";
}

// ✅ Log HTTP Requests with metadata
logger.httpRequest = (req, res, message = "HTTP Request Completed") => {
  const ua = parser.setUA(req.headers["user-agent"]).getResult();
  const requestId =
    req.headers["x-request-id"] ||
    Math.random().toString(36).substring(2, 12) + Date.now();
  const latencyMs = res.locals?.responseTime || null;

  logger[determineLevel(res.statusCode)](message, {
    timestamp: new Date().toISOString(),
    requestId,
    tenantId: req.headers["x-tenant-id"] || "Unknown",
    userId: req.user?.id || "Anonymous",
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode || "Unknown",
    userAgent: req.headers["user-agent"] || "Unknown",
    browser: ua.browser?.name || "Unknown",
    os: ua.os?.name || "Unknown",
    deviceType: ua.device?.type || "Desktop",
    ip: req.ip || req.connection?.remoteAddress,
    referrer: req.headers["referer"] || req.headers["referrer"] || "None",
    latencyMs,
    latencyBucket: latencyMs
      ? latencyMs < 100
        ? "<100ms"
        : latencyMs < 300
        ? "100–299ms"
        : latencyMs < 1000
        ? "300–999ms"
        : "1s+"
      : null,
    service: process.env.SERVICE_NAME || "unknown-service",
  });
};

// ✅ Handle Uncaught Errors & Rejections
process.on("uncaughtException", (err) => {
  logger.error("🔥 Uncaught Exception", {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("🔥 Unhandled Promise Rejection", { reason });
});

module.exports = logger;
