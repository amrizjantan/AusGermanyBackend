require("dotenv").config(); // Load environment variables from .env

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/auth"); // Authentication routes
const urlRoutes = require("./routes/urls"); // URL saving routes
const passwordResetRoutes = require("./routes/passwordReset"); // Password reset routes

const app = express();
const PORT = process.env.PORT || 5001;

console.log("MongoDB URI from environment:", process.env.MONGO_URI);

const corsOptions = {
  origin: "http://localhost:5173", // Replace with your frontend URL if different
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization",
};

app.use(cors(corsOptions)); // Use CORS middleware with options
app.use(express.json()); // Middleware to parse JSON

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

// Route setup
app.use("/api/auth", authRoutes); // Authentication routes
app.use("/api/urls", urlRoutes); // URL routes
app.use("/api/password-reset", passwordResetRoutes); // Password reset routes

// Fallback route for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
