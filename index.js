import express from "express";
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import session from "express-session";
import userRoutes from "./routes/users.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payment.js";
import passwordRoutes from "./routes/passwords.js";
import adminRoutes from "./routes/admins.js";
import uploadsRoutes from "./routes/uploads.js";

const app = express();
const PORT = process.env.PORT || 5001;

app.use(
  cors({
    origin: [
      "http://localhost:5173", // User
      "http://localhost:5174", // Admin
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Handle preflight requests
app.options("*", (req, res) => {
  res.sendStatus(204); // No Content
});

app.use(express.json()); // Middleware to parse JSON

const supabaseUrl = "https://obpujqjuhucirpkdqidf.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Route setup
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/passwords", passwordRoutes);
app.use("/api/admins", adminRoutes); // Admin routes !
app.use("/api/items", uploadsRoutes);

app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Fallback route for undefined routes
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key", // Change this for production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === "production" }, // Set secure cookie in production
  })
);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`); // eslint-disable-line no-console
});
