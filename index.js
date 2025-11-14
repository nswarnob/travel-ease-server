require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require("mongodb");
const port = process.env.PORT || 3000;


//cors 
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://travel-ease-client-eta.vercel.app/",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman)
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


//express middleware
app.use(express.json());



//firebase-related
const admin = require("firebase-admin");
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require("./firebase-key.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//middleware for authorization
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("Unauthorized person;");
  }
  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).send("Unauthorized person;");
  }
};

//server connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dveploj.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("myDB");
    const vehicleCollection = db.collection("vehicleDB");
    const bookingCollection = db.collection("carBookings");

    //public
    app.get("/all-vehicles", async (req, res) => {
      try {
        const vehicles = await vehicleCollection.find().toArray();
        res.json(vehicles);
      } catch (err) {
        console.error("Error fetching vehicles:", err);
      }
    });

    //added vehicles from frontend - private
    app.post("/all-vehicles", verifyFirebaseToken, async (req, res) => {
      try {
        const newVehicle = req.body;
        const newVehicles = await vehicleCollection.insertOne(newVehicle);
        res.json(newVehicles);
        res.status(201).send("Added Successfull");
      } catch (err) {
        console.log(err);
      }
    });

    //showcasing that are added by user
    app.get("/my-vehicles", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.user.email;
        let query = {};
        if (email) {
          query = { userEmail: email };
        }
        const userVehicles = await vehicleCollection.find(query).toArray();
        res.send(userVehicles);
      } catch (err) {
        console.log(err);
      }
    });

    //for update vehicle get old details
    app.get("/all-vehicles/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const vehicle = await vehicleCollection.findOne(query);
        res.send(vehicle);
      } catch (err) {
        console.log(err);
      }
    });

    //for update the vehicle details
    app.put("/all-vehicles/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const result = await vehicleCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    //remove my vehicles
    app.delete("/all-vehicles/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const id = req.params.id;
        const target = { _id: new ObjectId(id) };
        const result = await vehicleCollection.deleteOne(target);

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Vehicle not found" });
        }

        res.status(200).send({ message: "Vehicle deleted successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    //latest vehicles
    app.get("/latest-vehicles", async (req, res) => {
      try {
        const latestVehicles = await vehicleCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();
        res.json(latestVehicles);
      } catch (err) {
        console.log(err);
      }
    });

    //recieving and storing booking data
    app.post("/car-bookings", verifyFirebaseToken, async (req, res) => {
      try {
        const booking = req.body;
        const existingBooking = await bookingCollection.findOne({
          email: booking.email,
          booking_id: booking.booking_id,
        });

        if (existingBooking) {
          return res
            .status(409)
            .send({ message: "You already booked this car." });
        }
        const result = await bookingCollection.insertOne(booking);

        res.status(201).send("Booked Successfull");
      } catch (err) {
        console.log(err);
      }
    });

    //booking req showing by frontend user email
    app.get("/car-bookings", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.user.email;
        let query = {};
        if (email) {
          query = { email };
        }
        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings);
      } catch (err) {
        console.log(err);
      }
    });

    //booking data removing by frontend user req
    app.delete("/car-bookings/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const { id } = req.params;
        const finding = { _id: new ObjectId(id) };
        const result = await bookingCollection.deleteOne(finding);
        if (result.deletedCount === 1) {
          res.status(200).json({ message: "Booking deleted successfully" });
        } else {
          res.status(404).json({ message: "Booking not found" });
        }
      } catch (err) {
        console.log(err);
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

//api
app.get("/", (req, res) => {
  res.json({
    message: "Travel Ease Server is Running!",
    Timestamp: new Date().toISOString()
  });
});

module.exports = app;