  //added vehicles from frontend
    app.post("/all-vehicles", async (req, res) => {
      try {
        const newVehicle = req.body;
        const newVehicles = await vehicleCollection.insertOne(newVehicle);
        res.status(201).send("Added Successfull");
      } catch (err) {
        console.log(err);
      }
    });

    //showcasing that are added by user
    app.get("/all-vehicles", async (req, res) => {
      try {
        const email = req.query.email;
        let query = {};
        if (email) {
          query = { userEmail:email };
        }
        const userVehicles = await vehicleCollection.find(query).toArray();
        res.send(userVehicles);
        console.log("Querying vehicles for email:", email);

console.log("Found vehicles:", userVehicles);

      } catch (err) {
        console.log(err);
      }
    });
    