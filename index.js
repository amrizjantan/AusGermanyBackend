import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import urlRoutes from "./routes/urls.js";
import passwordResetRoutes from "./routes/passwordReset.js";

const app = express();
const PORT = process.env.PORT || 5001;

const corsOptions = {
  origin: "http://localhost:5173", // Replace with your frontend URL if different
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization",
};

app.use(cors(corsOptions)); // Use CORS middleware with options
app.use(express.json()); // Middleware to parse JSON

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected"); // eslint-disable-line no-console
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
  });

// Route setup
app.use("/api", authRoutes);
app.use("/api/urls", urlRoutes);
app.use("/api/password-reset", passwordResetRoutes);

// Fallback route for undefined routes
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`); // eslint-disable-line no-console
});
