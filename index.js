require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 3000;

//middleware
app.use(cors());
app.use(express.json());

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

    app.get("/all-vehicles", async (req, res) => {
      try {
        const vehicles = await vehicleCollection.find().toArray();
        res.json(vehicles);
      } catch (err) {
        console.error("Error fetching vehicles:", err);
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

    //recieving booking data
    app.post("/car-bookings", async (req, res) => {
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
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`travel-ease-server-running: ${port}`);
});
