const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

//middleware
app.use(cors());
app.use(express.json());

//database connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6ayxwna.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  //split token
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const database = client.db("bangaliana");
    const foodCollection = database.collection("food");
    const reviewsCollection = database.collection("reviews");
    const orderCollection = database.collection("order");
    const userCollection = database.collection("users");
    const paymentCollection = database.collection("payment");
    const userProfileCollection = database.collection("userProfile");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden" });
      }
    };

    app.get("/user", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;

      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: "1d",
        }
      );
      res.send({ result, token });
    });

    //user profile api
    app.post("/userProfile", async (req, res) => {
      const userProfile = req.body;
      const result = await userProfileCollection.insertOne(userProfile);
      res.send(result);
    });

    //get user profile api
    app.get("/userProfile", async (req, res) => {
      const cursor = userProfileCollection.find({});
      const userProfile = await cursor.toArray();
      res.send(userProfile);
    });

    app.get("/userProfile", async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const query = { email: email };
        const cursor = userProfileCollection.find(query);
        const userProfile = await cursor.toArray();
        return res.send(userProfile);
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    });

    //All Service api

    //food api
    //get api
    app.get("/food", async (req, res) => {
      const cursor = foodCollection.find({});
      const foods = await cursor.toArray();
      res.send(foods);
    });

    //get single food api
    app.get("/food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const food = await foodCollection.findOne(query);
      res.send(food);
    });

    //delete single food api
    app.delete("/food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await foodCollection.deleteOne(query);
      res.json(result);
    });

    //Post api
    app.post("/food", async (req, res) => {
      const food = req.body;
      console.log("hit the post api", food);

      const result = await foodCollection.insertOne(food);

      console.log(result);
      res.send(result);
    });

    // update api
    app.put("/food/:id", async (req, res) => {
      const foodId = req.params.id;
      const foodUpdates = req.body;

      try {
        const result = await foodCollection.updateOne(
          { _id: ObjectId(foodId) },
          { $set: foodUpdates }
        );

        console.log(result);

        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send("Error updating food.");
      }
    });

    //Review api
    //get api
    app.get("/reviews", async (req, res) => {
      const cursor = reviewsCollection.find({});
      const reviews = await cursor.toArray();
      res.send(reviews);
    });

    //post api
    app.post("/reviews", async (req, res) => {
      const newReview = req.body;
      console.log("hit the post api", newReview);

      const result = await reviewsCollection.insertOne(newReview);
      res.json(result);
    });

    //order api
    //get api
    app.get("/order", async (req, res) => {
      const query = {};
      const cursor = orderCollection.find(query);
      const allOrder = await cursor.toArray();
      res.send(allOrder);
    });

    //get order by email
    app.get("/order", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const query = { email: email };
        const cursor = orderCollection.find(query);
        const orders = await cursor.toArray();
        return res.send(orders);
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    });

    // get single order by id
    app.get("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.findOne(query);
      res.send(result);
    });

    //delete single order api
    app.delete("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.json(result);
    });

    //post api
    app.post("/order", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      // console.log(result);
      res.send(result);
    });

    // for update
    app.put("/order/:id", async (req, res) => {
      const updateOrder = req.body[0];
      const id = req.params.id;
      // console.log(updateOrder);
      const filter = { _id: ObjectId(id) };

      const options = { upsert: true };

      const updateDoc = {
        $set: {
          email: updateOrder.email,
          price: updateOrder.price,
          status: updateOrder.status,
          description: updateOrder.description,
          phone: updateOrder.phone,
        },
      };
      const result = await orderCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      // console.log(result);
      res.send(result);
    });

    //for partial update
    app.patch("/order/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      await paymentCollection.insertOne(payment);
      await orderCollection.updateOne(filter, updateDoc);
      res.send(updateDoc);
    });

    //payment api
    app.post("/create-payment-intent", async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
  } finally {
    //await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Running food on server");
});

app.listen(port, () => {
  console.log("listening to port", port);
});
