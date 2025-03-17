// models/Vehicle.js
const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    // 🧑 User Association
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔗 Shop-Ware Sync
    shopWareId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // 🚗 Core Vehicle Info
    vin: { type: String, required: true, unique: true },
    make: { type: String },
    model: { type: String },
    trim: { type: String }, // e.g., EX, Sport
    year: { type: Number },
    bodyStyle: { type: String }, // e.g., Sedan, SUV
    color: { type: String },
    licensePlate: { type: String },
    registrationState: { type: String }, // e.g., KS
    engineType: { type: String }, // e.g., V6, Electric
    transmission: { type: String }, // e.g., Automatic, Manual
    drivetrain: { type: String }, // e.g., AWD, FWD
    fuelType: { type: String }, // e.g., Gasoline, Diesel, Electric
    cylinders: { type: Number }, // e.g., 4, 6, 8

    // 🧮 Mileage & Usage (Manually Entered or via Telematics Sync)
    currentMileage: {
      type: Number,
      default: 0,
      description: "Manually entered or updated via Telematics event",
    },
    estimatedMilesPerYear: {
      type: Number,
      default: 12000,
      description: "Manual estimate; replaced with telematics over time",
    },

    // 🛡️ Maintenance & Ownership
    purchaseDate: { type: Date },
    warrantyExpiration: { type: Date },
    lastServiceDate: { type: Date },
    odometerAtLastService: { type: Number },
    serviceDueMileage: { type: Number },
    serviceAlert: { type: Boolean, default: false },

    // 💡 Status & Ownership
    status: {
      type: String,
      enum: ["active", "inactive", "archived", "sold"],
      default: "active",
    },
    ownershipType: {
      type: String,
      enum: ["owned", "leased", "rented"],
      default: "owned",
    },
    isFleetVehicle: { type: Boolean, default: false },
    fleetNumber: { type: String },

    // 📡 Telematics Link
    telematicsId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TelematicsRecord",
      description: "Reference to the Telematics Microservice record",
    },

    // 📝 Notes & Metadata
    tags: [{ type: String }], // e.g., ['Family Car', 'Work Vehicle']
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
