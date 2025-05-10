const swaggerJsDoc = require("swagger-jsdoc");

const swaggerOptions = {
 definition: {
    openapi: "3.0.0",
    info: {
      title: "Vehicle Management API",
      version: "1.0.0",
      description: "API documentation for the Vehicle Management service",
    },
  },
  apis: ["./routes/*.js"], // Path to route files
};

module.exports = swaggerJsDoc(swaggerOptions);
