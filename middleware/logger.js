const logger = require("../utils/logger");

const logRequestMiddleware = (req, res, next) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const [sec, nano] = process.hrtime(start);
    res.locals.responseTime = Math.round(sec * 1000 + nano / 1e6); // in ms
    logger.httpRequest(req, res);
  });

  next();
};

module.exports = logRequestMiddleware;
