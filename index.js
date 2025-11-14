require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// CORS -
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://travel-ease-client-eta.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Express middleware
app.use(express.json());

// Firebase setup
const admin = require("firebase-admin");
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require("./firebase-key.json");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Middleware for authorization
const verifyFirebaseToken = async (req, res, next) => {
  if (!req.headers) {
    return res.status(401).send({ message: "Unauthorized person" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized person - No token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(401).send({ message: "Unauthorized person" });
  }
};

// ===== GLOBAL DATABASE VARIABLES =====
let db;
let vehicleCollection;
let bookingCollection;
let isConnected = false;

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dveploj.mongodb.net/myDB?retryWrites=true&w=majority`;

async function connectToDatabase() {
  if (isConnected) {
    console.log("Using existing database connection");
    return;
  }

  try {
    console.log("Connecting to MongoDB...");
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    console.log("MongoDB connected successfully!");

    // Initialize global variables
    db = client.db("myDB");
    vehicleCollection = db.collection("vehicleDB");
    bookingCollection = db.collection("carBookings");
    
    // Test connection
    await db.command({ ping: 1 });
    console.log("MongoDB ping successful!");
    
    isConnected = true;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    isConnected = false;
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

// Initialize database connection
connectToDatabase().catch(console.error);

// Middleware to ensure DB connection before handling requests
const ensureDbConnection = async (req, res, next) => {
  if (!isConnected) {
    try {
      await connectToDatabase();
    } catch (error) {
      return res.status(500).json({ error: "Database connection failed" });
    }
  }
  next();
};

// Apply DB connection middleware to all routes
app.use(ensureDbConnection);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Travel Ease Server is Running!",
    timestamp: new Date().toISOString(),
  });
});

// ===== PUBLIC ROUTES =====

// Get all vehicles
app.get("/all-vehicles", async (req, res) => {
  try {
    const vehicles = await vehicleCollection.find().toArray();
    res.json(vehicles);
  } catch (err) {
    console.error("Error fetching vehicles:", err);
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});

// Get latest vehicles
app.get("/latest-vehicles", async (req, res) => {
  try {

    const latestVehicles = await vehicleCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.json(latestVehicles);
  } catch (err) {
    console.error("Error fetching latest vehicles:", err);
    res.status(500).json({ error: "Failed to fetch latest vehicles" });
  }
});

// ===== PROTECTED ROUTES =====

// Add new vehicle
app.post("/all-vehicles", verifyFirebaseToken, async (req, res) => {
  try {
    const newVehicle = req.body;
    const result = await vehicleCollection.insertOne(newVehicle);
    res.status(201).json({
      message: "Added successfully",
      vehicleId: result.insertedId,
    });
  } catch (err) {
    console.error("Error adding vehicle:", err);
    res.status(500).json({ error: "Failed to add vehicle" });
  }
});

// Get user's vehicles
app.get("/my-vehicles", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.user.email;
    const query = { userEmail: email };
    const userVehicles = await vehicleCollection.find(query).toArray();
    res.json(userVehicles);
  } catch (err) {
    console.error("Error fetching user vehicles:", err);
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});

// Get single vehicle for update
app.get("/all-vehicles/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const vehicle = await vehicleCollection.findOne(query);

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.json(vehicle);
  } catch (err) {
    console.error("Error fetching vehicle:", err);
    res.status(500).json({ error: "Failed to fetch vehicle" });
  }
});

// Update vehicle
app.put("/all-vehicles/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const id = req.params.id;
    const updatedData = req.body;
    const result = await vehicleCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.json({ message: "Vehicle updated successfully", result });
  } catch (err) {
    console.error("Error updating vehicle:", err);
    res.status(500).json({ error: "Failed to update vehicle" });
  }
});

// Delete vehicle
app.delete("/all-vehicles/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await vehicleCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    res.status(200).json({ message: "Vehicle deleted successfully" });
  } catch (err) {
    console.error("Error deleting vehicle:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Create booking
app.post("/car-bookings", verifyFirebaseToken, async (req, res) => {
  try {
    const booking = req.body;

    const existingBooking = await bookingCollection.findOne({
      email: booking.email,
      booking_id: booking.booking_id,
    });

    if (existingBooking) {
      return res.status(409).json({ message: "You already booked this car." });
    }

    const result = await bookingCollection.insertOne(booking);
    res.status(201).json({
      message: "Booked successfully",
      bookingId: result.insertedId,
    });
  } catch (err) {
    console.error("Error creating booking:", err);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// Get user's bookings
app.get("/car-bookings", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.user.email;
    const query = { email };
    const bookings = await bookingCollection.find(query).toArray();
    res.json(bookings);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Delete booking
app.delete("/car-bookings/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await bookingCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Booking deleted successfully" });
    } else {
      res.status(404).json({ message: "Booking not found" });
    }
  } catch (err) {
    console.error("Error deleting booking:", err);
    res.status(500).json({ error: "Failed to delete booking" });
  }
});

module.exports = app;
