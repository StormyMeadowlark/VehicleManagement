const Redis = require("ioredis");
const logger = require("./logger");

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

redis.on("connect", () => logger.info("✅ Redis connected"));
redis.on("error", (err) =>
  logger.error("❌ Redis error", { error: err.message })
);

module.exports = redis;
