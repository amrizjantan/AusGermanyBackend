require("dotenv").config(); // Load environment variables from .env

const express = require("express");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth"); // Correct path to auth routes

const app = express();
const PORT = process.env.PORT || 5001;

console.log("MongoDB URI from environment:", process.env.MONGO_URI); // Debugging output

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
  });

app.use(express.json());
// Route setup
app.use("/api", authRoutes); // Prefix the route if needed

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
