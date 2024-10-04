import express from "express";
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import userRoutes from "./routes/users.js";
import orderRoutes from "./routes/orders.js";
import passwordRoutes from "./routes/passwords.js";

const app = express();
const PORT = process.env.PORT || 5001;

const corsOptions = {
  origin: "http://localhost:5173", // Replace with your frontend URL if different
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization",
};

app.use(cors(corsOptions)); // Use CORS middleware with options
app.use(express.json()); // Middleware to parse JSON

const supabaseUrl = "https://obpujqjuhucirpkdqidf.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Route setup
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/passwords", passwordRoutes);

// Fallback route for undefined routes
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`); // eslint-disable-line no-console
});
